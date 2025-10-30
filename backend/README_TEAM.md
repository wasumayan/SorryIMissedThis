# Sorry I Missed This - Backend

Context-aware communication assistant API using Azure Cosmos DB and OpenAI.

## Team Quick Start

### Prerequisites
- Python 3.9+
- Azure subscription (team account already set up)
- OpenAI API key

### Setup (5 minutes)

1. **Clone and navigate to backend:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment:**

   Copy `.env.example` to `.env` and fill in the values:
   ```env
   # Azure Cosmos DB (ask team for credentials)
   COSMOS_ENDPOINT=https://sorryimissedthis-db.documents.azure.com:443/
   COSMOS_KEY=<get-from-azure-portal-or-team>
   COSMOS_DATABASE=sorryimissedthis

   # OpenAI
   OPENAI_API_KEY=<your-openai-key>

   # Flask
   FLASK_ENV=development
   PORT=5002
   CORS_ORIGINS=http://localhost:3000
   SECRET_KEY=<generate-random-string>
   ```

5. **Run the backend:**
   ```bash
   python run.py
   ```

   You should see:
   ```
   Azure Cosmos DB connection established successfully
   Server starting on http://0.0.0.0:5002
   ```

## Project Structure

```
backend/
├── app/
│   ├── __init__.py           # Flask app factory
│   ├── config.py             # Configuration
│   ├── routes/               # API endpoints
│   │   ├── auth.py           # Authentication
│   │   ├── upload.py         # File uploads
│   │   ├── recommendations.py # AI prompts
│   │   └── conversations.py  # Conversation management
│   ├── services/             # Business logic
│   │   ├── azure_storage.py  # Cosmos DB operations
│   │   ├── ai_service.py     # OpenAI integration
│   │   └── chat_parser.py    # Chat parsing
│   ├── models/               # Data models
│   └── utils/                # Helper functions
├── run.py                    # Application entry point
├── requirements.txt          # Python dependencies
└── .env                      # Environment variables (not in git)
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Data Upload
- `POST /api/upload/transcript` - Upload chat transcripts

### AI Features
- `GET /api/recommendations` - Get AI-generated conversation prompts

### Conversations
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/<id>` - Get specific conversation

### Analytics
- `GET /api/stats/<user_id>` - Get user statistics

## Development

### Running Tests
```bash
pytest
```

### Code Formatting
```bash
black .
flake8 .
```

### Adding a New Route

1. Create route in `app/routes/`:
   ```python
   from flask import Blueprint, jsonify

   my_route_bp = Blueprint('my_route', __name__)

   @my_route_bp.route('/my-endpoint', methods=['GET'])
   def my_function():
       return jsonify({'message': 'Hello'})
   ```

2. Register in `app/__init__.py`:
   ```python
   from app.routes.my_route import my_route_bp
   app.register_blueprint(my_route_bp, url_prefix='/api/my-route')
   ```

## Azure Resources

**Team Azure Resources:**
- Subscription: `COS-cos436fall25_team02`
- Resource Group: `COS-cos436fall25_team02-budget-rg`
- Cosmos DB: `sorryimissedthis-db`
- Location: East US

**View in Azure Portal:**
[Click here](https://portal.azure.com/#@/resource/subscriptions/3ED49111-5CFE-49C4-8B05-31400A1B784A/resourceGroups/COS-cos436fall25_team02-budget-rg)

### Database Structure

**Cosmos DB Containers:**
- `users` - User accounts and profiles
- `sessions` - Authentication sessions
- `conversations` - Chat conversations
- `prompts` - AI-generated prompts

## Deployment

### Deploy to Azure App Service

See [AZURE_COMPLETE_SETUP.md](AZURE_COMPLETE_SETUP.md) for full deployment guide.

Quick deploy:
```bash
./setup_azure_existing.sh
```

## Troubleshooting

### "Database not configured" error
- Check `.env` file has correct `COSMOS_ENDPOINT` and `COSMOS_KEY`
- Ask team for Azure credentials if needed
- Verify you can access Azure Portal

### Connection errors
- Ensure you're on Princeton network or VPN
- Check Azure Cosmos DB firewall settings
- Verify subscription is active

### Import errors
- Make sure virtual environment is activated
- Run `pip install -r requirements.txt` again

## Team Guidelines

### Before Pushing Code
1. Run tests: `pytest`
2. Format code: `black .`
3. Check linting: `flake8 .`
4. Update this README if adding new features

### Environment Variables
- **Never commit `.env` file**
- Share Azure credentials securely (not in code)
- Use team's shared Azure resources

### Git Workflow
1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and commit
3. Push and create PR
4. Get team review before merging

## Support

- **Technical Issues**: Check troubleshooting section above
- **Azure Access**: Contact team lead
- **API Questions**: See [AZURE_COMPLETE_SETUP.md](AZURE_COMPLETE_SETUP.md)

## Resources

- [Azure Cosmos DB Docs](https://docs.microsoft.com/azure/cosmos-db/)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [OpenAI API Docs](https://platform.openai.com/docs/)
