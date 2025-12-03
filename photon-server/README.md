# Photon iMessage Bridge Server

This is a Node.js bridge server that connects the Photon iMessage SDK to the Python backend.

## Prerequisites

1. **macOS** - Required for iMessage access
2. **Node.js 18+** - For running the server
3. **Photon Account** - Sign up at [photon.codes](https://photon.codes)

## Setup

### 1. Install Dependencies

```bash
cd photon-server
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your Photon server URL:

```env
PHOTON_SERVER_URL=https://yourname.imsgd.photon.codes
```

### 3. Get Your Photon Server URL

1. Sign up at [photon.codes](https://photon.codes)
2. Follow their setup instructions to connect your Mac
3. Get your subdomain (e.g., `yourname.imsgd.photon.codes`)
4. Add it to `.env`

### 4. Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will start on `http://localhost:3001` by default.

## API Endpoints

### Health Check
```
GET /health
```

### Connect to Photon
```
POST /api/connect
```

### Get All Chats
```
GET /api/chats?limit=100
```

### Get Messages
```
GET /api/messages?chatGuid=<guid>&limit=100&offset=0
```

### Send Message
```
POST /api/messages/send
Body: { "chatGuid": "...", "message": "..." }
```

### Get Contacts
```
GET /api/contacts
```

## Integration with Python Backend

Update your Python backend `.env` to point to this bridge server:

```env
PHOTON_SERVER_URL=http://localhost:3001
```

The Python backend will communicate with this Node.js bridge, which in turn communicates with the Photon iMessage SDK.

## Troubleshooting

### "Failed to connect to Photon server"

1. Check that `PHOTON_SERVER_URL` is set correctly in `.env`
2. Verify your Photon account is set up
3. Ensure your Mac has iMessage permissions
4. Check Photon's documentation for setup issues

### "Module not found" errors

Run `npm install` to ensure all dependencies are installed.

### Port already in use

Change `PHOTON_PORT` in `.env` to use a different port.

## Development

The server uses Express.js and provides a REST API that the Python backend can consume. All iMessage operations go through the Photon SDK, which requires macOS and proper permissions.

## Security

- This server should only run on your local machine or a secure network
- Don't expose it to the public internet without authentication
- The server has access to your iMessage data - keep it secure

