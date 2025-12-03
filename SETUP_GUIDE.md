# 🚀 Complete Setup Guide - Sorry I Missed This

This guide will help you set up and run the entire SIMT application from scratch.

## 📋 Prerequisites

Before starting, make sure you have:

1. **Node.js 18+** - [Download here](https://nodejs.org/)
   ```bash
   node --version  # Should be v18 or higher
   ```

2. **Python 3.8+** - Usually pre-installed on macOS
   ```bash
   python3 --version  # Should be 3.8 or higher
   ```

3. **macOS** - Required for iMessage integration (the app will work on other platforms but iMessage features won't)

4. **Git** - To clone the repository (if needed)

## 🎯 Quick Setup (Recommended)

The easiest way to get started is using the automated script:

```bash
# Make the script executable
chmod +x quickstart.sh

# Run it
./quickstart.sh
```

This script will:
- ✅ Check all prerequisites
- ✅ Create all `.env` files with defaults
- ✅ Install all dependencies
- ✅ Start all three services (Photon, Backend, Frontend)

**That's it!** The app will be running at http://localhost:3000

---

## 📝 Manual Setup (Step-by-Step)

If you prefer to set up manually or the script doesn't work:

### Step 1: Clone/Navigate to Project

```bash
cd /Users/Mayan/Documents/WasuIndustries/SorryIMissedThis
```

### Step 2: Set Up Backend (Python)

```bash
# Navigate to backend
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

**Create `backend/.env` file:**

```env
# Flask Configuration
FLASK_ENV=development
SECRET_KEY=dev-secret-key-change-in-production
PORT=5002

# CORS
CORS_ORIGINS=http://localhost:3000

# Azure Cosmos DB (REQUIRED for production - leave empty for development/testing)
COSMOS_ENDPOINT=
COSMOS_KEY=
COSMOS_DATABASE=sorryimissedthis

# Azure OpenAI (Required for AI features - get from Azure Portal)
AZURE_OPENAI_API_KEY=your-azure-openai-key-here
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.7

# iMessage Integration (Photon)
PHOTON_SERVER_URL=http://localhost:3001
PHOTON_API_KEY=

# Analytics
DORMANT_DAYS_THRESHOLD=14
CONTEXT_WINDOW_MESSAGES=100
MAX_PROMPT_SUGGESTIONS=3

# Logging
LOG_LEVEL=INFO
```

**Start the backend:**

```bash
# Make sure venv is activated
source venv/bin/activate

# Run the server
python run.py
```

You should see: `Running on http://0.0.0.0:5002`

### Step 3: Set Up Photon Bridge Server (Node.js)

**Note:** This is only needed for iMessage integration on macOS.

```bash
# Navigate to photon-server
cd ../photon-server

# Install dependencies
npm install
```

**Create `photon-server/.env` file:**

```env
# Photon Server URL (get from photon.codes after signing up)
PHOTON_SERVER_URL=https://yourname.imsgd.photon.codes

# Python Backend URL
PYTHON_BACKEND_URL=http://localhost:5002

# Port for bridge server
PORT=3001
```

**Get Photon Account:**
1. Sign up at [photon.codes](https://photon.codes)
2. Get your server URL (e.g., `https://yourname.imsgd.photon.codes`)
3. Add it to `PHOTON_SERVER_URL` in `.env`

**Start the Photon server:**

```bash
npm start
```

You should see: `Photon bridge server running on port 3001`

### Step 4: Set Up Frontend (React)

```bash
# Navigate to frontend
cd ../FigmaFrontEnd

# Install dependencies
npm install
```

**Create `FigmaFrontEnd/.env` file:**

```env
VITE_API_URL=http://localhost:5002/api
```

**Start the frontend:**

```bash
npm run dev
```

You should see: `Local: http://localhost:3000`

---

## 🌐 Access the Application

Once all services are running:

- **Frontend (Main App)**: http://localhost:3000
- **Backend API**: http://localhost:5002
- **API Health Check**: http://localhost:5002/health
- **Photon Bridge**: http://localhost:3001 (macOS only)

---

## ⚙️ Configuration Details

### Required for Full Functionality

1. **Azure OpenAI API Key** (Required for AI features)
   - Get from [Azure Portal](https://portal.azure.com)
   - Create an Azure OpenAI resource
   - Get the API key from "Keys and Endpoint"
   - Add to `backend/.env` as `AZURE_OPENAI_API_KEY`

2. **Photon Account** (Required for iMessage)
   - Sign up at [photon.codes](https://photon.codes)
   - Get your server URL
   - Add to `photon-server/.env` as `PHOTON_SERVER_URL`

### Required for Production

3. **Azure Cosmos DB** (Required for data persistence)
   - **IMPORTANT**: Without this, data won't persist between restarts
   - Create in Azure Portal
   - Get endpoint and key
   - Add to `backend/.env`:
     - `COSMOS_ENDPOINT=your-endpoint`
     - `COSMOS_KEY=your-key`

---

## 🎮 Running All Services

### Option 1: Use Quickstart Script (Easiest)

```bash
./quickstart.sh
```

Press `Ctrl+C` to stop all services.

### Option 2: Run in Separate Terminals

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python run.py
```

**Terminal 2 - Photon Server (macOS only):**
```bash
cd photon-server
npm start
```

**Terminal 3 - Frontend:**
```bash
cd FigmaFrontEnd
npm run dev
```

---

## 🐛 Troubleshooting

### Port Already in Use

If you get "port already in use" errors:

**Backend:**
- Change `PORT=5002` to `PORT=5003` in `backend/.env`
- Update `VITE_API_URL` in `FigmaFrontEnd/.env` to match

**Frontend:**
- Edit `FigmaFrontEnd/vite.config.ts` and change `server.port`

**Photon:**
- Change `PORT=3001` to `PORT=3002` in `photon-server/.env`
- Update `PHOTON_SERVER_URL` in `backend/.env` to match

### "Failed to connect to Photon server"

1. Check `PHOTON_SERVER_URL` is set correctly in `photon-server/.env`
2. Verify your Photon account is active
3. Ensure you're on macOS (required for iMessage)
4. Check Photon server is running: `curl http://localhost:3001/api/status`

### "Module not found" errors

Reinstall dependencies:
```bash
# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd FigmaFrontEnd
npm install

# Photon
cd photon-server
npm install
```

### Frontend can't connect to backend

1. Verify backend is running: `curl http://localhost:5002/health`
2. Check `VITE_API_URL` in `FigmaFrontEnd/.env` matches backend port
3. Check CORS settings in `backend/.env`: `CORS_ORIGINS=http://localhost:3000`

### "Azure OpenAI API key not set"

- The app will work but AI features won't function
- Add your Azure OpenAI key to `backend/.env`
- Get key from Azure Portal

### "Cosmos DB not configured"

- App will run in development mode
- Data won't persist between restarts
- For production, add Cosmos DB credentials to `backend/.env`

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] Backend running on port 5002
- [ ] Frontend running on port 3000
- [ ] Photon server running on port 3001 (macOS)
- [ ] Can access http://localhost:3000
- [ ] Health check works: http://localhost:5002/health
- [ ] No errors in browser console
- [ ] Can complete onboarding flow

---

## 🎯 First Time Usage

1. Open http://localhost:3000 in your browser
2. Enter your name
3. Connect to iMessage (if on macOS)
4. Select which chats to track
5. Complete onboarding
6. Your grove will appear!

---

## 🛑 Stopping Services

**If using quickstart.sh:**
- Press `Ctrl+C` in the terminal

**If running manually:**
- Press `Ctrl+C` in each terminal window
- Or find and kill processes:
  ```bash
  # Find processes
  lsof -ti:3000  # Frontend
  lsof -ti:5002  # Backend
  lsof -ti:3001  # Photon
  
  # Kill them
  kill $(lsof -ti:3000)
  kill $(lsof -ti:5002)
  kill $(lsof -ti:3001)
  ```

---

## 📚 Next Steps

- Read `QUICKSTART.md` for more details
- Check `IMESSAGE_SETUP.md` for iMessage configuration
- See `AZURE_COMPLETE_SETUP.md` for Azure setup
- Review `CODEBASE_OVERVIEW.md` for architecture details

---

## 💡 Tips

- Keep all three terminals open while developing
- Check logs if something doesn't work:
  - Backend: Look at terminal output
  - Frontend: Check browser console (F12)
  - Photon: Check terminal output
- Use `tail -f` to watch log files if using quickstart.sh
- The app works without Cosmos DB for testing, but data won't persist

---

## 🆘 Need Help?

- Check the troubleshooting section above
- Review log files in `/tmp/` if using quickstart.sh
- Check browser console for frontend errors
- Verify all `.env` files are configured correctly

