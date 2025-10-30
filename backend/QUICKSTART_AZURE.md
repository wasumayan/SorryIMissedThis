# Azure Quick Start (15 minutes)

Get Sorry I Missed This running on Azure in 15 minutes!

## Step 1: Create Azure Cosmos DB (5 min)

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **"+ Create a resource"** → Search **"Azure Cosmos DB"**
3. Click **"Create"** → Select **"Azure Cosmos DB for NoSQL"**
4. Fill in:
   - Resource Group: **Create new** → `sorryimissedthis-rg`
   - Account Name: `sorryimissedthis-cosmos` (or any unique name)
   - Location: Choose closest to you
   - Capacity mode: **Serverless** (cheapest!)
5. Click **"Review + create"** → **"Create"**
6. Wait ~3 minutes for deployment

## Step 2: Get Cosmos DB Credentials (2 min)

1. Click **"Go to resource"** after deployment
2. Left sidebar → **"Keys"**
3. Copy these two values:
   - **URI** (looks like: `https://....documents.azure.com:443/`)
   - **PRIMARY KEY** (long string)

## Step 3: Configure Backend (3 min)

1. Open `backend/.env`:
   ```env
   COSMOS_ENDPOINT=<paste URI here>
   COSMOS_KEY=<paste PRIMARY KEY here>
   COSMOS_DATABASE=sorryimissedthis

   OPENAI_API_KEY=your-openai-key
   FLASK_ENV=development
   PORT=5002
   CORS_ORIGINS=http://localhost:3000
   SECRET_KEY=my-dev-secret-key
   ```

2. Install dependencies:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

## Step 4: Run Backend (1 min)

```bash
python run.py
```

You should see:
```
Azure Cosmos DB connection established successfully
Database: sorryimissedthis
Cosmos DB containers initialized
Server starting on http://0.0.0.0:5002
```

## Step 5: Test It! (2 min)

Open a new terminal and test registration:

```bash
curl -X POST http://localhost:5002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "testpass123"
  }'
```

You should get a success response with a token!

## Step 6: Verify in Azure (2 min)

1. Go back to Azure Portal → Your Cosmos DB resource
2. Click **"Data Explorer"**
3. Expand **"sorryimissedthis"** → **"users"**
4. You should see your test user!

## Done! 🎉

Your backend is now running locally with Azure Cosmos DB!

### Next Steps:

- **Run frontend**: See frontend README
- **Deploy to Azure**: See [AZURE_COMPLETE_SETUP.md](AZURE_COMPLETE_SETUP.md)
- **Add more features**: Start building!

### Cost:
- **Development**: ~$1-3/month (mostly free with serverless Cosmos DB)
- **No credit card required for Azure free tier** (12 months free services)

## Troubleshooting

### "Database not configured" error
- Double-check `COSMOS_ENDPOINT` and `COSMOS_KEY` in `.env`
- Make sure there are no extra spaces
- Restart the backend server

### Connection errors
- Verify Cosmos DB is created and running in Azure Portal
- Check firewall settings in Cosmos DB → Allow access from all networks (for development)

### Still having issues?
- See full guide: [AZURE_COMPLETE_SETUP.md](AZURE_COMPLETE_SETUP.md)
- Check Azure Portal → Cosmos DB → Monitoring for errors
