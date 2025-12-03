# Real-Time iMessage Integration

## Overview

The system now supports real-time message listening and processing. When new messages arrive via iMessage, they are automatically:
1. Detected by the Photon SDK
2. Forwarded from bridge server to Python backend
3. Processed and stored in the database
4. Available for prompt generation and analytics

## Architecture

### Flow Diagram

```
iMessage (macOS)
    ↓
Photon Server (cloud)
    ↓
Bridge Server (Node.js, localhost:3001)
    ├─→ Real-time events via Socket.IO
    └─→ HTTP webhook → Python Backend (localhost:5002)
            ↓
        Process & Store
            ↓
        Update Conversations
            ↓
        Trigger AI Analysis (if needed)
```

## Components

### 1. Bridge Server (`photon-server/server.js`)

**Real-time Event Handling:**
- Listens for `new-message` events from Photon SDK
- Forwards messages to Python backend via HTTP webhook
- Handles `updated-message` events (read receipts, etc.)

**Configuration:**
```env
PYTHON_BACKEND_URL=http://localhost:5002
```

### 2. Python Backend (`backend/app/routes/imessage.py`)

**Webhook Endpoint:**
- `POST /api/imessage/webhook` - Receives real-time message events

**Listening Endpoints:**
- `POST /api/imessage/listen/start` - Start polling for messages
- `POST /api/imessage/listen/stop` - Stop listening

### 3. Message Processing

When a new message arrives:

1. **Webhook receives event** from bridge server
2. **Extract message data:**
   - `chatGuid` - Identifies the conversation
   - `text` - Message content
   - `sender` - Who sent it
   - `isFromMe` - Whether it's from the user
   - `timestamp` - When it was sent

3. **Find or create conversation:**
   - Search database for conversation with matching `chatGuid`
   - If not found, create new conversation

4. **Store message:**
   - Add message to conversation
   - Update conversation metrics
   - Update last contact time

5. **Trigger updates:**
   - Regenerate AI prompts if needed
   - Update relationship health status
   - Refresh frontend if connected

## Setup

### 1. Configure Bridge Server

Edit `photon-server/.env`:
```env
PHOTON_SERVER_URL=https://yourname.imsgd.photon.codes
PYTHON_BACKEND_URL=http://localhost:5002
```

### 2. Start Bridge Server

```bash
cd photon-server
npm start
```

The bridge server will:
- Connect to Photon server
- Wait for "ready" event
- Start forwarding messages automatically

### 3. Start Python Backend

```bash
cd backend
python run.py
```

### 4. Start Listening (Optional)

The bridge server automatically forwards messages via webhook. For polling-based listening:

```bash
curl -X POST http://localhost:5002/api/imessage/listen/start
```

## Real-Time Events

### New Message Event

**Bridge Server receives:**
```javascript
sdk.on('new-message', (data) => {
  // data contains:
  // - guid: message ID
  // - chatGuid: conversation ID
  // - text: message content
  // - handle: sender info
  // - isFromMe: boolean
  // - date: timestamp
});
```

**Forwarded to Python:**
```json
{
  "type": "new-message",
  "data": {
    "guid": "message-id",
    "chatGuid": "conversation-id",
    "text": "Hello!",
    "handle": { "address": "+1234567890" },
    "isFromMe": false,
    "date": 1234567890
  }
}
```

### Message Updated Event

For read receipts, delivery status, etc.:
```json
{
  "type": "message-updated",
  "data": {
    "guid": "message-id",
    "dateRead": 1234567890,
    "dateDelivered": 1234567890
  }
}
```

## Message Processing Logic

### Identifying User Messages

The system needs to identify which messages are from the user vs. contacts:

```python
is_from_me = message_data.get('isFromMe', False)
sender = message_data.get('handle', {}).get('address', 'Unknown')

if is_from_me:
    # This is a message the user sent
    # Can be used for style analysis
else:
    # This is an incoming message from a contact
    # Process for conversation updates
```

### Finding Conversations

Conversations are stored with `chatGuid` in the `chatGuid` or `chat_guid` field:

```python
# Search for conversation by chatGuid
conversation = storage.find_conversation_by_chat_guid(chat_guid)
```

## Frontend Integration

### Polling for Updates

The frontend can poll for new messages:

```typescript
// Poll every 5 seconds
setInterval(async () => {
  const response = await apiClient.getConversations();
  // Update UI with new messages
}, 5000);
```

### WebSocket (Future)

For true real-time updates, consider adding WebSocket support:

1. Python backend: Use Flask-SocketIO
2. Bridge server: Forward events via WebSocket
3. Frontend: Connect to WebSocket for instant updates

## Testing

### Test Real-Time Messages

1. **Send a test message** from another device to your Mac
2. **Check bridge server logs:**
   ```
   New message received: chat-guid
   Message text: Hello!
   ```

3. **Check Python backend logs:**
   ```
   New message received: Hello! from +1234567890
   Processing new message: Hello!
   ```

4. **Verify in database:**
   - Message should appear in conversation
   - Conversation metrics should update
   - Last contact time should refresh

## Troubleshooting

### Messages Not Being Received

1. **Check bridge server connection:**
   ```bash
   curl http://localhost:3001/health
   ```
   Should show `"ready": true`

2. **Check Python backend:**
   ```bash
   curl http://localhost:5002/health
   ```

3. **Check webhook forwarding:**
   - Bridge server logs should show "Forwarding message to backend"
   - Python backend logs should show "New message received"

### Webhook Not Working

1. **Verify PYTHON_BACKEND_URL:**
   ```env
   PYTHON_BACKEND_URL=http://localhost:5002
   ```

2. **Check CORS settings** in Python backend
3. **Check firewall** - ensure ports are accessible

## Future Enhancements

1. **WebSocket Support** - Real-time bidirectional communication
2. **Message Deduplication** - Prevent processing same message twice
3. **Batch Processing** - Handle multiple messages efficiently
4. **Auto-Reply** - Respond to messages automatically
5. **Message Filtering** - Filter spam or unwanted messages
6. **Rich Media** - Handle images, videos, attachments

