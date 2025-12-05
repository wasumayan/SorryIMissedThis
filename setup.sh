#!/bin/bash

# This script will automatically set up the Sorry I Missed This application

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

# Print header
clear
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     Sorry I Missed This (SIMT) - Study Setup for macOS        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS only."
    print_error "Please use a MacBook to participate in this study."
    exit 1
fi

print_success "Running on macOS"

# Check for required commands
print_status "Checking prerequisites..."

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    print_warning "Homebrew not found. Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    print_success "Homebrew installed"
else
    print_success "Homebrew found"
    # Update Homebrew to support newer macOS versions
    print_status "Updating Homebrew..."
    brew update &> /dev/null || print_warning "Homebrew update skipped (may be on newer macOS beta)"
fi

# Check for Python 3.9+
if ! command -v python3 &> /dev/null; then
    print_warning "Python 3 not found. Installing Python..."
    brew install python@3.11 || brew install python3
    print_success "Python installed"
else
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d'.' -f1)
    PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d'.' -f2)

    # Check if Python is 3.9 or higher (works for 3.9, 3.10, 3.11, 3.12, 3.13, etc.)
    if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 9 ]); then
        print_warning "Python version $PYTHON_VERSION is too old (need 3.9+). Installing newer Python..."
        brew install python@3.11 || brew install python3
        print_success "Python upgraded"
    else
        print_success "Python $PYTHON_VERSION found"
    fi
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    print_warning "Node.js not found. Installing Node.js..."
    brew install node
    print_success "Node.js installed"
else
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if (( NODE_VERSION < 18 )); then
        print_warning "Node.js version is too old. Updating to latest..."
        brew upgrade node
        print_success "Node.js updated"
    else
        print_success "Node.js $(node --version) found"
    fi
fi

# Setup Backend
print_status "Setting up backend..."

cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_status "Creating Python virtual environment..."
    python3 -m venv venv
    print_success "Virtual environment created"
else
    print_success "Virtual environment already exists"
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

# Install Python dependencies
print_status "Installing Python dependencies (this may take a few minutes)..."
pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt > /dev/null 2>&1
print_success "Python dependencies installed"

# Setup environment file
if [ ! -f ".env" ]; then
    print_status "Setting up backend configuration..."
    cp .env.example .env
    print_success "Backend configuration created"
else
    print_success "Backend configuration already exists"
fi

# Return to root directory
cd ..

# Setup Frontend
print_status "Setting up frontend..."

cd FigmaFrontEnd

# Install npm dependencies
print_status "Installing frontend dependencies (this may take a few minutes)..."
npm install > /dev/null 2>&1
print_success "Frontend dependencies installed"

# Frontend .env should already exist in repo
if [ ! -f ".env" ]; then
    print_warning "Frontend configuration not found. Creating default..."
    echo "VITE_API_URL=http://localhost:5002/api" > .env
    print_success "Frontend configuration created"
else
    print_success "Frontend configuration exists"
fi

# Return to root directory
cd ..

# Setup Photon Server (iMessage bridge)
print_status "Setting up iMessage integration..."

cd photon-server

# Install photon-server dependencies
print_status "Installing iMessage bridge dependencies..."
npm install > /dev/null 2>&1
print_success "iMessage bridge dependencies installed"

# Check if .env exists
if [ ! -f ".env" ]; then
    print_warning "Photon configuration not found."
    print_warning "You will need to set up Photon manually (see photon-server/README.md)"
    cp .env.example .env
    print_success "Created template .env file in photon-server/"
fi

# Return to root directory
cd ..

# Create convenience launch scripts
print_status "Creating launch scripts..."

# Create start-backend.sh
cat > start-backend.sh << 'EOF'
#!/bin/bash
cd backend
source venv/bin/activate
echo "Starting backend on http://localhost:5002..."
python run.py
EOF
chmod +x start-backend.sh

# Create start-frontend.sh
cat > start-frontend.sh << 'EOF'
#!/bin/bash
cd FigmaFrontEnd
echo "Starting frontend on http://localhost:5173..."
npm run dev
EOF
chmod +x start-frontend.sh

# Create start-photon.sh
cat > start-photon.sh << 'EOF'
#!/bin/bash
cd photon-server
echo "Starting Photon iMessage bridge on http://localhost:4000..."
npm start
EOF
chmod +x start-photon.sh

# Create start-all.command (double-clickable)
cat > start-all.command << 'EOF'
#!/bin/bash

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Open new terminal windows for each service
osascript <<APPLESCRIPT
tell application "Terminal"
    -- Backend
    do script "cd '$DIR' && ./start-backend.sh"

    -- Wait a bit for backend to start
    delay 3

    -- Frontend
    do script "cd '$DIR' && ./start-frontend.sh"

    -- Photon Server (if configured)
    if (do shell script "test -f '$DIR/photon-server/.env' && echo 'yes' || echo 'no'") = "yes" then
        do script "cd '$DIR' && ./start-photon.sh"
    end if

    activate
end tell
APPLESCRIPT
EOF
chmod +x start-all.command

print_success "Launch scripts created"

# Final instructions
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 Setup Complete! ✓                              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
print_status "To start the application, you have two options:"
echo ""
echo -e "  ${BLUE}Option 1:${NC} Double-click ${GREEN}start-all.command${NC} (easiest)"
echo -e "    - This will open 2-3 terminal windows automatically"
echo ""
echo -e "  ${BLUE}Option 2:${NC} Run each component separately in different terminals:"
echo -e "    ${GREEN}./start-backend.sh${NC}   - Start the backend server"
echo -e "    ${GREEN}./start-frontend.sh${NC}  - Start the frontend app"
echo -e "    ${GREEN}./start-photon.sh${NC}    - Start iMessage integration (if configured)"
echo ""
print_status "After starting, open your browser to:"
echo -e "  ${GREEN}http://localhost:5173${NC}"
echo ""
print_warning "IMPORTANT: iMessage Integration Setup"
echo "  If you want to use iMessage features:"
echo "  1. Sign up at https://photon.codes"
echo "  2. Follow their setup instructions"
echo "  3. Update photon-server/.env with your Photon URL"
echo "  4. See photon-server/README.md for details"
echo ""
print_status "For help, contact the research team"
echo ""
echo -e "${BLUE}Thank you for participating in our study!${NC}"
echo ""
