# Sorry I Missed This - Backend API

This is the backend API for the "Sorry I Missed This" application - a context-aware communication assistant.

## Prerequisites

- Python 3.9 or higher
- pip
- Google Cloud account (for Firestore)
- OpenAI API key

## Quick Start

### Step 1: Navigate to backend directory

After cloning the GitHub repo:

```bash
cd backend
```

### Step 2: Create and activate a virtual environment

**IMPORTANT: Do NOT use `sudo` when creating the virtual environment!**

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment (on Mac/Linux)
source venv/bin/activate
```

### Step 3: Install dependencies

```bash
pip install -r requirements.txt
```

### Step 4: Configure environment variables

The `.env` file should already exist with the following variables:

```env
OPENAI_API_KEY=your-openai-api-key
FIREBASE_CREDENTIALS_PATH=credentials/firebase-key.json
FLASK_ENV=development
PORT=5002
CORS_ORIGINS=http://localhost:3000
SECRET_KEY=your-secret-key
```

Make sure to:
1. Add your OpenAI API key
2. Place your Firebase credentials JSON file in `credentials/firebase-key.json`
3. **Enable Firestore in your Firebase project** - See [FIRESTORE_SETUP.md](FIRESTORE_SETUP.md) for instructions
4. Update `SECRET_KEY` to a secure random string for production

### Step 5: Run the backend server

```bash
python run.py
```

The server will start on `http://localhost:5002`

You should see output like:
```
Starting in DEVELOPMENT mode
CORS configured
   Allowed origins: ['http://localhost:3000']
Blueprints registered

============================================================
Sorry I Missed This - Context-Aware Communication Assistant
============================================================
Server starting on http://0.0.0.0:5002
Environment: development
Debug mode: True
CORS origins: ['http://localhost:3000']
============================================================

Available endpoints:
  - GET  /               : API information
  - GET  /health         : Health check
  - POST /api/auth/register     : User registration
  - POST /api/auth/login        : User login
  - POST /api/auth/logout       : User logout
  - GET  /api/auth/me           : Get current user
  - POST /api/upload/transcript : Upload chat transcripts
  - GET  /api/recommendations   : Get conversation prompts
  - GET  /api/conversations     : List all conversations
  - GET  /api/stats/<user_id>   : User statistics
============================================================
```

## Testing Authentication

Run the test script to verify authentication endpoints:

```bash
# Make sure the server is running first
./test_auth.sh
```

## API Endpoints

### Authentication

- **POST /api/auth/register** - Register a new user
  ```json
  {
    "name": "User Name",
    "email": "user@example.com",
    "password": "securepassword"
  }
  ```

- **POST /api/auth/login** - Login user
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword"
  }
  ```

- **POST /api/auth/logout** - Logout user (requires auth token)

- **GET /api/auth/me** - Get current user info (requires auth token)

### Data Upload

- **POST /api/upload/transcript** - Upload chat transcripts

### Recommendations

- **GET /api/recommendations** - Get AI-generated conversation prompts

### Conversations

- **GET /api/conversations** - List all conversations

### Analytics

- **GET /api/stats/<user_id>** - Get user statistics

## Deploying to Azure

See [AZURE_SETUP.md](AZURE_SETUP.md) for comprehensive Azure deployment instructions.

Quick deploy options:
1. **Azure CLI** - Fast command-line deployment
2. **GitHub Actions** - Automatic deployment on push
3. **Azure Portal** - GUI-based deployment

## Troubleshooting

### Virtual Environment Error: "Operation not permitted"

**Problem**: Getting `[Errno 1] Operation not permitted` when creating venv

**Solution**: Do NOT use `sudo`. Run the command as your regular user:
```bash
python3 -m venv venv
```

### Import Error: cannot import name 'db'

**Problem**: Auth routes can't import database client

**Solution**: Make sure `storage.py` has been updated with the global `db` export at the bottom of the file.

### Database Does Not Exist (404 Error)

**Problem**: Getting `404 The database (default) does not exist for project...`

**Solution**: You need to enable Firestore in your Firebase project. See [FIRESTORE_SETUP.md](FIRESTORE_SETUP.md) for detailed instructions.

Quick fix: Go to https://console.firebase.google.com, select your project, click "Firestore Database", and create a database.

### Firebase Connection Issues

**Problem**: Firebase initialization fails

**Solution**:
1. Check that `credentials/firebase-key.json` exists
2. Verify the path in `.env` matches the actual file location
3. Ensure your Firebase service account has proper permissions
4. Make sure Firestore is enabled (see [FIRESTORE_SETUP.md](FIRESTORE_SETUP.md))

### CORS Errors from Frontend

**Problem**: Frontend can't connect due to CORS

**Solution**:
1. Verify `CORS_ORIGINS` in `.env` includes your frontend URL
2. Default is `http://localhost:3000` for development
3. Restart the backend server after changing `.env`

## Project Structure

```
backend/
├── app/
│   ├── __init__.py           # Flask app factory
│   ├── config.py             # Configuration management
│   ├── routes/               # API endpoints
│   │   ├── auth.py           # Authentication routes
│   │   ├── upload.py         # Upload routes
│   │   ├── recommendations.py # AI recommendations
│   │   └── conversations.py  # Conversation management
│   ├── services/             # Business logic
│   │   ├── storage.py        # Firestore operations
│   │   ├── ai_service.py     # OpenAI integration
│   │   └── chat_parser.py    # Chat parsing
│   ├── models/               # Data models
│   └── utils/                # Helper functions
├── credentials/              # Firebase credentials (gitignored)
├── run.py                    # Application entry point
├── requirements.txt          # Python dependencies
├── .env                      # Environment variables (gitignored)
├── startup.sh               # Azure startup script
├── azure-deploy.yml         # Azure deployment config
└── test_auth.sh             # Authentication test script
```

## Development

### Running Tests

```bash
pytest
```

### Code Quality

```bash
# Format code
black .

# Lint code
flake8 .

# Type checking
mypy .
```
