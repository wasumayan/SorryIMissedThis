# Privacy Architecture: Local Message Storage

## Overview

To protect user privacy, **actual message content is stored locally on the device**, while only **metadata and analysis results** are stored in the cloud (Azure Cosmos DB).

## Data Storage Strategy

### Local Storage (Device)
- ✅ **Message content** (full text of all messages)
- ✅ **Message timestamps**
- ✅ **Sender information**
- ✅ **Message IDs**
- ✅ **Chat GUIDs** (for iMessage integration)

**Storage Method:** Browser `localStorage` (can be upgraded to IndexedDB for larger datasets)

### Cloud Storage (Azure Cosmos DB)
- ✅ **Conversation metadata** (partner name, category, status)
- ✅ **Analysis results** (contact classification: family/friends/work)
- ✅ **User texting style** (emoji usage, punctuation patterns, formality)
- ✅ **Metrics** (message count, reciprocity, response times, days since contact)
- ✅ **AI-generated prompts**
- ✅ **Conversation health status**
- ✅ **Last message timestamp** (for recency calculations)

**NOT Stored in Cloud:**
- ❌ Message content/text
- ❌ Full conversation history
- ❌ Personal information from messages

## Implementation Details

### Backend Changes

1. **Sync Process** (`imessage_service.py`):
   - Fetches messages from iMessage
   - Calculates metrics from message metadata
   - Stores only metadata in cloud
   - Returns message data to frontend for local storage

2. **Webhook Handler** (`imessage.py`):
   - Receives new messages in real-time
   - Updates conversation metadata (count, timestamps)
   - Returns message data to frontend for local storage
   - Does NOT store message content in cloud

3. **Storage Service** (`azure_storage.py`):
   - `add_message_to_conversation()` now only updates metadata
   - Message count incremented
   - Last message timestamp updated
   - Metrics recalculated (using locally-stored message data when needed)

### Frontend Changes

1. **Local Storage Service** (`localStorage.ts`):
   - `storeMessages()` - Store messages locally
   - `getMessages()` - Retrieve messages from local storage
   - `addMessage()` - Add single message
   - `getChatGuid()` - Get chat GUID for a conversation
   - `findConversationByChatGuid()` - Find conversation by GUID

2. **Sync Integration**:
   - When syncing, frontend receives message data
   - Stores messages locally using `localMessageStorage`
   - Only metadata sent to/from backend

3. **Real-time Updates**:
   - Webhook returns message data
   - Frontend stores message locally
   - UI updates from local storage

## Privacy Benefits

1. **Message Content Never Leaves Device**
   - Full message text stored only locally
   - Cloud only sees metadata (counts, timestamps)

2. **Analysis Without Exposure**
   - AI classification uses message content locally
   - Only classification result (family/friends/work) stored in cloud
   - Texting style analysis done locally, only patterns stored

3. **User Control**
   - Users can clear local storage anytime
   - No message content in cloud to delete
   - Local storage can be encrypted (future enhancement)

## Functionality Impact

### ✅ Works Normally
- Contact classification (AI analyzes locally, stores result)
- Texting style inference (analyzed locally, patterns stored)
- Metrics calculation (uses local messages)
- Prompt generation (uses local messages for context)
- Real-time message updates (stored locally)
- Conversation view (reads from local storage)

### ⚠️ Considerations
- **Multi-device sync**: Messages won't sync across devices (by design for privacy)
- **Backup**: Users need to backup local storage if desired
- **Storage limits**: Browser localStorage has ~5-10MB limit (can upgrade to IndexedDB)
- **Offline access**: Full functionality available offline

## Migration Path

For existing users with messages in cloud:
1. Frontend can fetch messages from backend
2. Store them locally
3. Backend can optionally delete message content (keep metadata)

## Future Enhancements

1. **IndexedDB Migration**: For larger message volumes
2. **Local Encryption**: Encrypt messages in local storage
3. **Selective Sync**: Option to sync specific conversations to cloud
4. **Export/Import**: Allow users to export/import local message data

## API Changes

### Sync Response
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "conv-123",
        "partnerName": "John",
        "chatGuid": "guid-123",
        "messageCount": 50,
        "messagesStoredLocally": true,
        "category": "friends",
        "metrics": { ... }
        // NO messages array
      }
    ]
  }
}
```

### Webhook Response
```json
{
  "success": true,
  "message_data": {
    "message_id": "msg-123",
    "timestamp": "2024-01-01T12:00:00Z",
    "sender": "John",
    "content": "Hello!"  // For frontend to store locally
  }
}
```

## Security Notes

- Local storage is accessible to JavaScript (can be encrypted)
- Cloud storage contains no sensitive message content
- Analysis results are anonymized (just patterns, not content)
- Users can clear local storage to remove all messages

