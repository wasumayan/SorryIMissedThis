# Photon Server Setup - Complete Guide

## ✅ What's Been Set Up

I've created a complete Photon iMessage bridge server setup for you. Here's what's included:

### Files Created

1. **`photon-server/`** - New directory with:
   - `server.js` - Express.js bridge server
   - `package.json` - Node.js dependencies
   - `.env.example` - Environment configuration template
   - `setup.sh` - Automated setup script
   - `README.md` - Detailed documentation

## 🚀 Quick Start

### Step 1: Run Setup Script

```bash
cd photon-server
./setup.sh
```

This will:
- Check Node.js installation
- Install all dependencies
- Create `.env` file from template

### Step 2: Configure Photon Server

1. **Sign up for Photon** (if you haven't):
   - Visit [photon.codes](https://photon.codes)
   - Create an account
   - Follow their setup instructions to connect your Mac

2. **Get your server URL**:
   - After setup, you'll get a subdomain like `yourname.imsgd.photon.codes`
   - Or use the local bridge server at `http://localhost:3001`

3. **Edit `.env` file**:
   ```bash
   cd photon-server
   nano .env
   ```
   
   Add your Photon server URL:
   ```env
   PHOTON_SERVER_URL=https://yourname.imsgd.photon.codes
   # OR use local bridge:
   # PHOTON_SERVER_URL=http://localhost:3001
   ```

### Step 3: Start the Bridge Server

```bash
cd photon-server
npm start
```

You should see:
```
✓ Connected to Photon iMessage server
✓ Photon Bridge Server running on http://localhost:3001
```

### Step 4: Configure Python Backend

Update your Python backend `.env` file:

```env
# Point to the local bridge server
PHOTON_SERVER_URL=http://localhost:3001
```

Or if using Photon's hosted service directly:
```env
PHOTON_SERVER_URL=https://yourname.imsgd.photon.codes
```

### Step 5: Test Connection

From your Python backend, test the connection:

```bash
curl http://localhost:3001/health
```

Or use the API endpoint:
```bash
curl -X POST http://localhost:3001/api/connect
```

## 📋 Architecture

```
┌─────────────────┐
│   Python        │
│   Backend       │
│   (Flask)       │
└────────┬────────┘
         │ HTTP
         │ (localhost:3001)
         ▼
┌─────────────────┐
│   Node.js        │
│   Bridge Server  │
│   (Express)      │
└────────┬────────┘
         │ SDK
         │ (Photon)
         ▼
┌─────────────────┐
│   Photon        │
│   iMessage      │
│   Server        │
└─────────────────┘
```

## 🔧 API Endpoints

The bridge server provides these endpoints:

### Health Check
```
GET /health
```

### Connect
```
POST /api/connect
```

### Get Chats
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

## 🐛 Troubleshooting

### "Cannot find module 'advanced-imessage-kit'"

The package is installed from GitHub. If you see this error:

```bash
cd photon-server
rm -rf node_modules package-lock.json
npm install
```

### "Failed to connect to Photon server"

1. Check that your Photon account is set up
2. Verify `PHOTON_SERVER_URL` in `.env` is correct
3. Ensure your Mac has iMessage permissions
4. Check Photon's documentation for setup issues

### "Port 3001 already in use"

Change the port in `.env`:
```env
PHOTON_PORT=3002
```

Then update Python backend `.env`:
```env
PHOTON_SERVER_URL=http://localhost:3002
```

### Bridge server won't start

1. Check Node.js version: `node -v` (needs 18+)
2. Reinstall dependencies: `npm install`
3. Check logs for specific errors

## 🔒 Security Notes

- The bridge server runs locally on your Mac
- It has access to your iMessage data
- Don't expose it to the public internet
- Keep your `.env` file secure (it's in `.gitignore`)

## 📝 Next Steps

1. ✅ Run `./setup.sh` in `photon-server/`
2. ✅ Configure `.env` with your Photon server URL
3. ✅ Start the bridge server: `npm start`
4. ✅ Update Python backend `.env` to point to `http://localhost:3001`
5. ✅ Test connection from Python backend
6. ✅ Run initial sync: `POST /api/imessage/sync`

## 🎯 Integration with SIMT

Once the bridge server is running:

1. **Python backend** connects to `http://localhost:3001`
2. **Bridge server** connects to Photon SDK
3. **Photon SDK** accesses iMessage on your Mac
4. **Data flows**: iMessage → Photon → Bridge → Python → Cosmos DB → Frontend

The Python backend's `imessage_service.py` is already configured to work with this setup!

## 📚 Additional Resources

- [Photon SDK GitHub](https://github.com/photon-hq/advanced-imessage-kit)
- [Photon Website](https://photon.codes)
- Bridge server README: `photon-server/README.md`

---

**Ready to go!** Start the bridge server and your Python backend will be able to access iMessage data in real-time. 🚀

