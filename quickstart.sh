#!/bin/bash

# Sorry I Missed This - Quickstart Script
# This script sets up and runs the entire SIMT application locally

set -e  # Exit on error

echo "🌳 Sorry I Missed This - Quickstart"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version must be 18 or higher. Current: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed. Please install Python 3.8+ first.${NC}"
    exit 1
fi
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo -e "${GREEN}✅ Python $PYTHON_VERSION${NC}"

# Check if on macOS (for iMessage)
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${YELLOW}⚠️  Warning: iMessage integration requires macOS${NC}"
fi

echo ""
echo "🔧 Setting up environment..."

# Create .env files if they don't exist
if [ ! -f backend/.env ]; then
    echo "Creating backend/.env file..."
    cat > backend/.env << EOF
# Flask Configuration
FLASK_ENV=development
SECRET_KEY=dev-secret-key-change-in-production
PORT=5002

# CORS
CORS_ORIGINS=http://localhost:3000

# Azure Cosmos DB (REQUIRED for production - leave empty for development/testing only)
COSMOS_ENDPOINT=
COSMOS_KEY=
COSMOS_DATABASE=sorryimissedthis

# Azure OpenAI (Required for AI features)
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.7

# iMessage Integration (Photon)
# This points to our Node.js bridge server (not the Photon server directly)
PHOTON_SERVER_URL=http://localhost:4000
PHOTON_API_KEY=

# Analytics
DORMANT_DAYS_THRESHOLD=14
CONTEXT_WINDOW_MESSAGES=100
MAX_PROMPT_SUGGESTIONS=3

# Logging
LOG_LEVEL=INFO
EOF
    echo -e "${GREEN}✅ Created backend/.env${NC}"
    echo -e "${YELLOW}⚠️  Please add your Azure OpenAI API key to backend/.env${NC}"
else
    echo -e "${GREEN}✅ backend/.env already exists${NC}"
fi

if [ ! -f FigmaFrontEnd/.env ]; then
    echo "Creating FigmaFrontEnd/.env file..."
    cat > FigmaFrontEnd/.env << EOF
VITE_API_URL=http://localhost:5002/api
EOF
    echo -e "${GREEN}✅ Created FigmaFrontEnd/.env${NC}"
else
    echo -e "${GREEN}✅ FigmaFrontEnd/.env already exists${NC}"
fi

if [ ! -f photon-server/.env ]; then
    echo "Creating photon-server/.env file..."
    cat > photon-server/.env << EOF
# Python backend URL for webhook forwarding
PYTHON_BACKEND_URL=http://localhost:5002

# Bridge server port
PORT=4000

# Optional: Enable debug logging
# PHOTON_LOG_LEVEL=debug
EOF
    echo -e "${GREEN}✅ Created photon-server/.env${NC}"
    echo -e "${YELLOW}⚠️  Note: The bridge server uses @photon-ai/imessage-kit which directly accesses your local iMessage database.${NC}"
    echo -e "${YELLOW}⚠️  Make sure you've granted Full Disk Access permission to Terminal/Node.js in System Settings.${NC}"
else
    echo -e "${GREEN}✅ photon-server/.env already exists${NC}"
fi

echo ""
echo "📦 Installing dependencies..."

# Backend Python dependencies
echo "Installing Python dependencies..."
cd backend
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo -e "${GREEN}✅ Python dependencies installed${NC}"
cd ..

# Frontend dependencies
echo "Installing frontend dependencies..."
cd FigmaFrontEnd
if [ ! -d "node_modules" ]; then
    npm install --silent
fi
echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
cd ..

# Photon server dependencies
echo "Installing Photon server dependencies..."
cd photon-server
if [ ! -d "node_modules" ]; then
    npm install --silent
fi
echo -e "${GREEN}✅ Photon server dependencies installed${NC}"
cd ..

echo ""
echo "🚀 Starting services..."
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $BACKEND_PID $FRONTEND_PID $PHOTON_PID 2>/dev/null || true
    exit
}
trap cleanup INT TERM

# Start Photon bridge server (if on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${GREEN}Starting Photon bridge server on port 4000...${NC}"
    cd photon-server
    npm start > /tmp/photon-server.log 2>&1 &
    PHOTON_PID=$!
    cd ..
    sleep 2
    echo -e "${GREEN}✅ Photon server started (PID: $PHOTON_PID)${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping Photon server (requires macOS)${NC}"
    PHOTON_PID=""
fi

# Start Python backend
echo -e "${GREEN}Starting Python backend on port 5002...${NC}"
cd backend
source venv/bin/activate
python run.py > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
cd ..
sleep 3
echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"

# Start frontend
echo -e "${GREEN}Starting frontend on port 3000...${NC}"
cd FigmaFrontEnd
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
sleep 3
echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"

echo ""
echo "===================================="
echo -e "${GREEN}✅ All services are running!${NC}"
echo ""
echo "📍 Services:"
echo "   • Frontend:    http://localhost:3000"
echo "   • Backend API: http://localhost:5002"
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "   • Photon Server: http://localhost:4000"
fi
echo ""
echo "📝 Logs:"
echo "   • Backend:    tail -f /tmp/backend.log"
echo "   • Frontend:   tail -f /tmp/frontend.log"
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "   • Photon:     tail -f /tmp/photon-server.log"
fi
echo ""
echo "🛑 Press Ctrl+C to stop all services"
echo ""

# Wait for user interrupt
wait

