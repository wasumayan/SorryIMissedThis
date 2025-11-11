# Quickstart Guide

## 🚀 One-Command Setup

Run the quickstart script to set up and start everything:

```bash
./quickstart.sh
```

This script will:
1. ✅ Check prerequisites (Node.js 18+, Python 3.8+)
2. ✅ Create `.env` files with default configuration
3. ✅ Install all dependencies (Python, Node.js)
4. ✅ Start all services:
   - Photon bridge server (port 3001) - macOS only
   - Python backend (port 5002)
   - React frontend (port 3000)

## 📋 Manual Setup

If you prefer to set up manually:

### 1. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:
```env
FLASK_ENV=development
SECRET_KEY=dev-secret-key-change-in-production
PORT=5002
CORS_ORIGINS=http://localhost:3000

# Azure OpenAI (Required for AI features)
AZURE_OPENAI_API_KEY=your-key-here
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini

# Azure Cosmos DB (REQUIRED for production - app will run in development mode without it but data won't persist)
COSMOS_ENDPOINT=your-cosmos-endpoint
COSMOS_KEY=your-cosmos-key
COSMOS_DATABASE=sorryimissedthis

# iMessage Integration
PHOTON_SERVER_URL=http://localhost:3001
```

Start backend:
```bash
python run.py
```

### 2. Frontend Setup

```bash
cd FigmaFrontEnd
npm install
```

Create `FigmaFrontEnd/.env`:
```env
VITE_API_URL=http://localhost:5002/api
```

Start frontend:
```bash
npm run dev
```

### 3. Photon Bridge Server (macOS only)

```bash
cd photon-server
npm install
```

Create `photon-server/.env`:
```env
PHOTON_SERVER_URL=https://yourname.imsgd.photon.codes
PYTHON_BACKEND_URL=http://localhost:5002
PORT=3001
```

**Note**: You need a Photon account. Sign up at [photon.codes](https://photon.codes) and get your server URL.

Start Photon server:
```bash
npm start
```

## 🌐 Access the Application

Once all services are running:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5002
- **Photon Bridge**: http://localhost:3001 (macOS only)

## 🔧 Configuration

### Required for Full Functionality

1. **Azure OpenAI API Key**: Required for AI prompt generation
   - Get from Azure Portal
   - Add to `backend/.env` as `AZURE_OPENAI_API_KEY`

2. **Photon Account** (for iMessage): Required for iMessage integration
   - Sign up at [photon.codes](https://photon.codes)
   - Get your server URL (e.g., `https://yourname.imsgd.photon.codes`)
   - Add to `photon-server/.env` as `PHOTON_SERVER_URL`

### Required for Production

- **Azure Cosmos DB**: For persistent data storage
  - **REQUIRED** for production use - data won't persist without it
  - Development/testing can run without it (data won't be saved between restarts)
  - Add `COSMOS_ENDPOINT` and `COSMOS_KEY` to `backend/.env`

## 🐛 Troubleshooting

### Port Already in Use

If a port is already in use, change it in the respective `.env` file:
- Backend: `PORT=5002` → `PORT=5003`
- Frontend: Edit `vite.config.ts` → `server.port`
- Photon: `PORT=3001` → `PORT=3002`

### "Failed to connect to Photon server"

1. Check `PHOTON_SERVER_URL` is set correctly
2. Verify your Photon account is active
3. Ensure you're on macOS (required for iMessage)
4. Check Photon server logs

### "Module not found" errors

Run `npm install` or `pip install -r requirements.txt` in the respective directory.

### Frontend can't connect to backend

1. Verify backend is running on port 5002
2. Check `VITE_API_URL` in `FigmaFrontEnd/.env`
3. Check CORS settings in `backend/.env`

## 📝 Next Steps

1. Open http://localhost:3000 in your browser
2. Complete onboarding to create your account
3. Connect iMessage (if on macOS with Photon setup)
4. Start managing your relationships! 🌳

## 🛑 Stopping Services

Press `Ctrl+C` in the terminal where you ran `quickstart.sh`, or stop each service individually:

- Backend: `Ctrl+C` in backend terminal
- Frontend: `Ctrl+C` in frontend terminal  
- Photon: `Ctrl+C` in photon-server terminal

