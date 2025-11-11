# iMessage Integration Setup

This document explains how to set up real-time iMessage integration using Photon's advanced-imessage-kit SDK.

## Overview

Instead of parsing WhatsApp exports, SIMT now supports real-time iMessage integration. This requires setting up a Photon server that runs on macOS and connects to your iMessage database.

## Prerequisites

1. **macOS** - iMessage integration only works on macOS
2. **Node.js/Bun** - For running the Photon server
3. **Photon Account** - Sign up at [photon.codes](https://photon.codes)

## Step 1: Set Up Photon Server

The Photon SDK requires a server component that runs on your Mac. You have two options:

### Option A: Use Photon's Hosted Service

1. Sign up for a Photon account at [photon.codes](https://photon.codes)
2. Get your subdomain (e.g., `yourname.imsgd.photon.codes`)
3. Follow Photon's setup instructions to connect your Mac

### Option B: Self-Hosted (Advanced)

1. Clone the Photon server repository
2. Set up the server on your Mac
3. Configure it to expose an HTTP API

## Step 2: Configure Backend

Add these environment variables to your `.env` file:

```env
# iMessage Integration (Photon)
PHOTON_SERVER_URL=https://yourname.imsgd.photon.codes
PHOTON_API_KEY=your-api-key-here  # If required by your Photon setup
```

## Step 3: Connect from Frontend

The frontend now has iMessage integration endpoints:

```typescript
// Connect to iMessage service
await apiClient.connectiMessage();

// Sync all conversations
await apiClient.synciMessage(userId);

// Check status
const status = await apiClient.getiMessageStatus();
```

## Step 4: Initial Sync

When a user first connects:

1. Call `POST /api/imessage/connect` to establish connection
2. Call `POST /api/imessage/sync` with the user's ID
3. The backend will:
   - Fetch all chats from iMessage
   - Get all messages for each chat
   - Calculate metrics (reciprocity, response time, etc.)
   - Store conversations in Cosmos DB
   - Calculate frequency for past 10 days

## Real-Time Updates

The iMessage service polls for new messages every 5 seconds. When new messages are detected:

1. Messages are processed and stored
2. Metrics are recalculated
3. Frontend can refresh to see updated grove

## API Endpoints

### `POST /api/imessage/connect`
Connect to the Photon iMessage server.

**Response:**
```json
{
  "success": true,
  "message": "Connected to iMessage service"
}
```

### `POST /api/imessage/sync`
Sync all iMessage conversations to the database.

**Request Body:**
```json
{
  "userId": "user-id-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Synced 25 conversations",
  "data": {
    "conversations_synced": 25,
    "conversation_ids": ["id1", "id2", ...]
  }
}
```

### `GET /api/imessage/status`
Get the current status of the iMessage service.

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "connected": true,
    "server_url": "https://yourname.imsgd.photon.codes"
  }
}
```

## Troubleshooting

### "Failed to connect to iMessage service"

1. Check that `PHOTON_SERVER_URL` is set correctly
2. Verify your Photon server is running
3. Check network connectivity
4. Verify API key if required

### "No conversations synced"

1. Ensure iMessage has conversations
2. Check Photon server logs
3. Verify user permissions for iMessage database access

### Messages not updating in real-time

1. Check that the listener is running (`is_listening: true` in status)
2. Verify message polling interval (default: 5 seconds)
3. Check backend logs for errors

## Migration from WhatsApp Upload

If you were previously using WhatsApp uploads:

1. Your existing conversations will remain in the database
2. New iMessage conversations will be added
3. You can still use the upload endpoint for historical data
4. Consider running a one-time sync to import all iMessage history

## Security Notes

- iMessage data stays on your Mac (Photon server)
- Only message metadata and content are synced to Cosmos DB
- API keys should be kept secure
- Consider encrypting sensitive message content

## Next Steps

- [ ] Set up Photon server
- [ ] Configure environment variables
- [ ] Test connection
- [ ] Run initial sync
- [ ] Verify grove visualization updates

For more information, see the [Photon SDK documentation](https://github.com/photon-hq/advanced-imessage-kit).

