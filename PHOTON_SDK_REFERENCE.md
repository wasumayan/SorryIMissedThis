# Photon iMessage SDK Reference

This document references the cloned Photon SDK repository for implementation details.

## Repository Location

The Photon SDK reference is cloned at:
```
photon-imessage-kit-reference/
```

## Key Examples

### Basic Message Sending
**File**: `examples/message-send.ts`

```typescript
const message = await sdk.messages.sendMessage({
    chatGuid: CHAT_GUID,
    message: "Hello from MOBAI!",
});
```

### Basic Event Listening
**File**: `examples/demo-basic.ts`

```typescript
sdk.on("ready", () => {
    console.log("ready");
});

sdk.on("new-message", (message) => {
    console.log(`New message: ${message.text}`);
});

await sdk.connect();
```

### Chat Fetching
**File**: `examples/chat-fetch.ts`

```typescript
const chats: Chat[] = await sdk.chats.getChats();
chats.forEach((chat) => {
    console.log(`${chat.displayName || chat.chatIdentifier} (${chat.guid})`);
});
```

## SDK Structure

### Main Export
**File**: `index.ts`

```typescript
export { AdvancedIMessageKit, SDK } from "./mobai";
export type { Chat, Handle, Message } from "./interfaces";
```

### SDK Initialization
**File**: `mobai.ts`

The SDK:
- Uses Socket.IO for real-time events
- Emits "ready" event when connected
- Requires waiting for "ready" before sending messages
- Uses HTTP client for API calls

### Message Module
**File**: `modules/message.ts`

Key methods:
- `sendMessage(options: SendMessageOptions): Promise<Message>`
- `getMessages(options): Promise<Message[]>`
- `getMessage(guid: string): Promise<Message>`

### Chat Module
**File**: `modules/chat.ts`

Key methods:
- `getChats(): Promise<Chat[]>`
- `getChat(guid: string): Promise<Chat>`
- `createChat(options): Promise<Chat>`

## Important Notes

1. **Ready Event**: Always wait for "ready" event before sending messages
2. **Connection**: SDK uses Socket.IO for real-time updates
3. **Error Handling**: SDK emits "error" events for failures
4. **Chat GUID Format**: Uses format like `"any;-;+1234567890"`

## API Endpoints Used by SDK

The SDK communicates with Photon server at endpoints like:
- `/api/v1/message/text` - Send message
- `/api/v1/message/query` - Get messages
- `/api/v1/chat/query` - Get chats
- `/api/v1/chat/{guid}` - Get specific chat

## Bridge Server Implementation

Our bridge server (`photon-server/server.js`) wraps the SDK and:
- Waits for "ready" event before marking as connected
- Provides REST API endpoints for Python backend
- Handles connection state management
- Forwards SDK events

## References

- [Photon SDK GitHub](https://github.com/photon-hq/advanced-imessage-kit)
- [Photon Website](https://photon.codes)

