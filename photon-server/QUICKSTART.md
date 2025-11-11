# Quick Start - Photon Bridge Server

## 🚀 Get Started in 3 Steps

### 1. Run Setup
```bash
cd photon-server
./setup.sh
```

### 2. Configure
Edit `.env` and add your Photon server URL:
```env
PHOTON_SERVER_URL=https://yourname.imsgd.photon.codes
```

Get your URL from [photon.codes](https://photon.codes) after signing up.

### 3. Start Server
```bash
npm start
```

That's it! The server will run on `http://localhost:3001`

## ✅ Verify It's Working

```bash
curl http://localhost:3001/health
```

Should return:
```json
{
  "status": "healthy",
  "connected": true,
  "serverUrl": "https://yourname.imsgd.photon.codes"
}
```

## 🔗 Connect Python Backend

Update your Python backend `.env`:
```env
PHOTON_SERVER_URL=http://localhost:3001
```

Now your Python backend can access iMessage data!

## 📚 Full Documentation

See `README.md` for complete documentation.

