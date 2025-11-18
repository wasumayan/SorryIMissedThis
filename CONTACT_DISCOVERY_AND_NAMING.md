# Contact Discovery and Name Assignment

This document explains how the system finds contacts from iMessage and assigns names to them.

## Overview

The system uses a **multi-tier fallback strategy** to find and name contacts:

1. **Find chats** from iMessage via Photon SDK
2. **Get display names** from macOS Contacts app (via bridge server)
3. **Infer names** using AI from message history (if no saved contact)
4. **Extract contact info** from chat ID (phone/email) as fallback
5. **Use generic fallback** ("Unknown Contact") as last resort

---

## Complete Flow: From iMessage to Named Contact

### Step 1: User Initiates Sync

```
User clicks "Sync Messages" in frontend
  ↓
POST /api/imessage/sync
  ↓
Backend: imessage.py → sync_imessage()
```

### Step 2: Get All Chats from iMessage

**Location**: `backend/app/services/imessage_service.py` → `sync_conversations()`

```python
# Fetch all chats from Photon bridge server
chats = await self.get_chats(limit=200)
```

**What happens**:
- Calls Photon bridge server: `GET /api/chats?limit=200`
- Bridge server uses Photon SDK to read directly from macOS iMessage database
- Returns list of chats with:
  - `chatId`: Unique identifier (e.g., `"iMessage;+1234567890"` or `"iMessage;user@example.com"`)
  - `displayName`: Name from Contacts app (if contact is saved) or `null`
  - `isGroup`: Whether it's a group chat
  - `lastMessageDate`: Last message timestamp

**Bridge Server Enhancement** (`photon-server/server.js`):
- If `displayName` is `null` and it's a DM (not group chat):
  - Extracts phone/email from `chatId`
  - Looks up name in macOS Contacts app using AppleScript
  - Caches the result to avoid redundant lookups
  - Sets `displayName` if found

### Step 3: Filter Chats (Based on User Preferences)

**Location**: `backend/app/services/imessage_service.py` → `sync_conversations()`

The system filters chats based on user's tracking preferences:

- **`all`**: Process all chats
- **`recent`**: Process only the N most recent chats (sorted by `lastMessageDate`)
- **`selected`**: Process only chats with IDs in `selectedChatIds` list

```python
if tracking_mode == 'all':
    chats_to_process = chats
elif tracking_mode == 'recent':
    sorted_chats = sorted(chats, key=lambda c: c.get('lastMessageDate'), reverse=True)
    chats_to_process = sorted_chats[:max_chats]
elif tracking_mode == 'selected':
    chats_to_process = [c for c in chats if c.get('chatId') in selected_chat_ids]
```

### Step 4: Process Each Chat (Parallel Batch Processing)

**Location**: `backend/app/services/imessage_service.py` → `sync_conversations()` → `process_chat()`

For each chat, the system:

1. **Fetches messages** (up to 100 for analysis):
   ```python
   all_messages = await self.get_messages(chat_id, limit=100, offset=0)
   ```

2. **Extracts contact info** from `chatId`:
   ```python
   contact_info = name_service.extract_contact_info_from_chat_id(chat_id)
   # Returns: {'phone_number': '+1234567890', 'email': None, 'service': 'iMessage'}
   ```

3. **Determines display name** using fallback strategy (see below)

### Step 5: Name Assignment (Multi-Tier Fallback)

**Location**: `backend/app/services/name_inference.py` → `infer_and_format_display_name()`

The system tries multiple methods in order:

#### Tier 1: Saved Contact Name (Best)

```python
if display_name and not self._is_just_contact_info(display_name):
    return display_name
```

**What it checks**:
- If `displayName` from bridge server exists
- If it's a real name (not just phone/email)
- Uses `_is_just_contact_info()` to detect if name is just contact info

**Example**: `displayName = "John Smith"` → Returns `"John Smith"`

#### Tier 2: AI Name Inference (Most Reliable for Unsaved Contacts)

**Location**: `backend/app/services/name_inference.py` → `infer_name_from_messages()`

```python
if messages:
    inferred = self.infer_name_from_messages(messages, phone_number)
    if inferred:
        return inferred
```

**What it does**:
1. Filters messages to only those from the contact (not from user)
2. Gets last 20 messages from contact
3. Calls AI service to extract name from message content

**AI Prompt** (`backend/app/services/ai_service.py` → `infer_contact_name()`):
```
Analyze the following messages from a contact and extract their name if mentioned.

Messages:
[Last 10 messages from contact]

Phone number: +1234567890

Instructions:
1. Look for the contact's name in introductions, signatures, or when they refer to themselves
2. Common patterns: "Hi, this is [Name]", "It's [Name]", "- [Name]", "From: [Name]", "Sent from [Name]'s iPhone"
3. Return ONLY the name (first name or full name), nothing else
4. If no name can be determined, return "null"
5. Return a single name, not multiple names

Name:
```

**AI Response**: Returns name like `"John"` or `"John Smith"` or `"null"`

**Example**: 
- Messages contain: `"Hi, this is John from work"`
- AI extracts: `"John"`
- Returns: `"John"`

#### Tier 3: Extract from Chat ID (Fallback)

**Location**: `backend/app/services/name_inference.py` → `extract_contact_info_from_chat_id()`

```python
contact_info = self.extract_contact_info_from_chat_id(chat_id)
if contact_info.get('phone_number'):
    return contact_info['phone_number']
elif contact_info.get('email'):
    return contact_info['email']
```

**What it does**:
- Parses `chatId` format: `"iMessage;+1234567890"` or `"iMessage;user@example.com"`
- Extracts phone number or email
- Returns formatted phone number (e.g., `"+1234567890"`) or email

**Example**:
- `chatId = "iMessage;+1234567890"` → Returns `"+1234567890"`
- `chatId = "iMessage;john@example.com"` → Returns `"john@example.com"`

#### Tier 4: Generic Fallback (Last Resort)

```python
return 'Unknown Contact'
```

Used only if all other methods fail.

---

## Name Inference Service Details

### `NameInferenceService` Class

**Location**: `backend/app/services/name_inference.py`

**Key Methods**:

1. **`infer_and_format_display_name()`** - Main method (uses all tiers)
2. **`infer_name_from_messages()`** - AI-powered name extraction
3. **`extract_contact_info_from_chat_id()`** - Parse phone/email from chatId
4. **`_is_just_contact_info()`** - Check if name is just phone/email

### `_is_just_contact_info()` Logic

This method determines if a "name" is actually just contact information:

```python
def _is_just_contact_info(self, name: str) -> bool:
    # If name has letters (not just digits), it's probably a real name
    if any(c.isalpha() for c in name):
        # Check if it's just an email
        if '@' in name and '.' in name.split('@')[1]:
            # Check if it's JUST an email (no other text)
            parts = name.split('@')
            if len(parts) == 2 and not any(c.isalpha() for c in parts[0].replace('.', '').replace('_', '').replace('-', '')):
                return True  # It's just an email
        else:
            return False  # Has letters and not just email = real name
    
    # Phone number patterns (only if no letters)
    cleaned = name.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    if cleaned.startswith('+') and cleaned[1:].isdigit():
        return True  # It's a phone number
    if cleaned.isdigit() and len(cleaned) >= 10:
        return True  # It's a phone number
    
    return False
```

**Examples**:
- `"+1234567890"` → `True` (just phone)
- `"john@example.com"` → `True` (just email)
- `"John Smith"` → `False` (real name)
- `"John"` → `False` (real name)
- `"John's iPhone"` → `False` (real name with text)

---

## Chat ID Format

The `chatId` format varies based on the contact type:

### Direct Message (DM) Format

```
"iMessage;+1234567890"        # Phone number
"iMessage;user@example.com"  # Email
"SMS;+1234567890"             # SMS (not iMessage)
```

**Structure**: `"{service};{identifier}"`

### Group Chat Format

```
"chat1234567890abcdef..."     # Long alphanumeric string (group chat GUID)
```

**Note**: Group chats don't have phone/email identifiers, so name extraction relies on:
1. Display name from Contacts (if group has a saved name)
2. AI inference from messages (if participants mention the group name)
3. Fallback to "Group Chat" or similar

---

## Complete Example Flow

### Example 1: Contact Saved in Contacts App

```
1. User syncs iMessage
   ↓
2. Bridge server gets chat: chatId="iMessage;+1234567890", displayName=null
   ↓
3. Bridge server looks up in Contacts app → Finds "John Smith"
   ↓
4. Bridge server returns: displayName="John Smith"
   ↓
5. Backend receives: displayName="John Smith"
   ↓
6. NameInferenceService.infer_and_format_display_name():
   - Tier 1: displayName="John Smith" exists and is real name → Returns "John Smith"
   ↓
7. Conversation created with partner_name="John Smith"
```

### Example 2: Contact NOT Saved, But Name in Messages

```
1. User syncs iMessage
   ↓
2. Bridge server gets chat: chatId="iMessage;+1234567890", displayName=null
   ↓
3. Bridge server looks up in Contacts app → Not found (returns null)
   ↓
4. Backend receives: displayName=null
   ↓
5. Backend fetches 100 messages from chat
   ↓
6. NameInferenceService.infer_and_format_display_name():
   - Tier 1: displayName is null → Skip
   - Tier 2: AI inference from messages:
     * Messages contain: "Hi, this is John from work"
     * AI extracts: "John"
     * Returns: "John"
   ↓
7. Conversation created with partner_name="John"
```

### Example 3: No Name Found Anywhere

```
1. User syncs iMessage
   ↓
2. Bridge server gets chat: chatId="iMessage;+1234567890", displayName=null
   ↓
3. Bridge server looks up in Contacts app → Not found
   ↓
4. Backend receives: displayName=null
   ↓
5. Backend fetches 100 messages from chat
   ↓
6. NameInferenceService.infer_and_format_display_name():
   - Tier 1: displayName is null → Skip
   - Tier 2: AI inference from messages:
     * Messages don't contain name
     * AI returns: "null"
   - Tier 3: Extract from chatId:
     * chatId="iMessage;+1234567890"
     * Extracts: phone_number="+1234567890"
     * Returns: "+1234567890"
   ↓
7. Conversation created with partner_name="+1234567890"
```

---

## Code Locations Summary

### Backend

1. **Main sync route**: `backend/app/routes/imessage.py` → `sync_imessage()`
2. **Sync service**: `backend/app/services/imessage_service.py` → `sync_conversations()`
3. **Name inference**: `backend/app/services/name_inference.py` → `NameInferenceService`
4. **AI name extraction**: `backend/app/services/ai_service.py` → `infer_contact_name()`
5. **Helper utilities**: `backend/app/utils/helpers.py` → `get_partner_name()`

### Bridge Server (Node.js)

1. **Chat retrieval**: `photon-server/server.js` → `GET /api/chats`
2. **Contact lookup**: `photon-server/server.js` → `lookupContactName()`
3. **Contact info extraction**: `photon-server/server.js` → `extractContactInfo()`

---

## Privacy Considerations

**Important**: The system does NOT store message content in the cloud. Only metadata is stored:

- ✅ **Stored**: Partner name, message count, timestamps, metrics
- ❌ **NOT Stored**: Message text content, attachments, media

Messages are:
1. Fetched from iMessage (via Photon SDK)
2. Processed locally to calculate metrics
3. Used for AI name inference (sent to Azure OpenAI API)
4. **Discarded** - only metadata is saved to Cosmos DB

---

## Troubleshooting

### Issue: All contacts show as phone numbers

**Possible causes**:
1. Contacts not saved in macOS Contacts app
2. AI inference failing (check Azure OpenAI API key)
3. Messages don't contain name references

**Solutions**:
- Check Azure OpenAI API key is set: `AZURE_OPENAI_API_KEY`
- Check API key has proper permissions
- Verify messages contain name references (e.g., "Hi, this is John")

### Issue: Some contacts show as "Unknown Contact"

**Possible causes**:
1. Chat ID format not recognized
2. No messages in chat
3. All name inference methods failed

**Solutions**:
- Check chat has messages (at least 1)
- Verify chatId format is correct
- Check logs for name inference errors

### Issue: Name inference is slow

**Possible causes**:
1. Too many chats being processed
2. AI API calls taking too long
3. Sequential processing instead of parallel

**Solutions**:
- Use `tracking_mode='recent'` with `max_chats=50` to limit processing
- Use `tracking_mode='selected'` to process only specific chats
- System already processes chats in parallel batches (5 at a time)

---

## Future Enhancements

1. **Caching**: Cache AI-inferred names to avoid redundant API calls
2. **Name Updates**: Re-infer names periodically if contact is saved later
3. **Group Chat Names**: Better extraction of group chat names from messages
4. **Multiple Names**: Handle cases where contact uses different names in different contexts
5. **Name Confidence**: Track confidence score for inferred names

