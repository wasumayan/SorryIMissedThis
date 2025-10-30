# Complete Azure Setup Guide for Sorry I Missed This

This guide will walk you through setting up all Azure services needed for the Sorry I Missed This backend.

## Overview

We'll be using these Azure services:
- **Azure Cosmos DB** - NoSQL database for storing user data, conversations, and sessions
- **Azure App Service** - Hosting the Flask backend API
- **Azure OpenAI Service** (optional) - For AI features

## Prerequisites

- Azure account (free tier available)
- Azure CLI installed
- Python 3.9+
- Git

## Part 1: Set Up Azure Cosmos DB (5-10 minutes)

Azure Cosmos DB will replace Firestore and store all your application data.

### Option A: Via Azure Portal (Easiest)

**Step 1: Create Cosmos DB Account**

1. Go to [Azure Portal](https://portal.azure.com)
2. Click "+ Create a resource"
3. Search for "Azure Cosmos DB" and click "Create"
4. Choose "Azure Cosmos DB for NoSQL" (not MongoDB, Cassandra, etc.)
5. Fill in the details:
   - **Subscription**: Select your subscription
   - **Resource Group**: Create new → "sorryimissedthis-rg"
   - **Account Name**: "sorryimissedthis-cosmos" (must be globally unique)
   - **Location**: Choose closest to you (e.g., "East US")
   - **Capacity mode**: "Serverless" (cheapest option, perfect for development)
6. Click "Review + create" → "Create"
7. Wait 3-5 minutes for deployment

**Step 2: Get Connection Credentials**

1. After deployment, click "Go to resource"
2. In the left sidebar, click "Keys"
3. Copy these values:
   - **URI** (this is your COSMOS_ENDPOINT)
   - **PRIMARY KEY** (this is your COSMOS_KEY)

**Step 3: Update .env File**

Open `backend/.env` and update:

```env
COSMOS_ENDPOINT=<paste your URI here>
COSMOS_KEY=<paste your PRIMARY KEY here>
COSMOS_DATABASE=sorryimissedthis
```

### Option B: Via Azure CLI (Faster if you know CLI)

```bash
# Login to Azure
az login

# Create resource group
az group create --name sorryimissedthis-rg --location eastus

# Create Cosmos DB account (serverless mode)
az cosmosdb create \
  --name sorryimissedthis-cosmos \
  --resource-group sorryimissedthis-rg \
  --kind GlobalDocumentDB \
  --locations regionName=eastus failoverPriority=0 \
  --default-consistency-level Session \
  --enable-automatic-failover false \
  --capabilities EnableServerless

# Get connection string
az cosmosdb keys list \
  --name sorryimissedthis-cosmos \
  --resource-group sorryimissedthis-rg \
  --type connection-strings

# Get keys
az cosmosdb keys list \
  --name sorryimissedthis-cosmos \
  --resource-group sorryimissedthis-rg
```

### Verify Cosmos DB Setup

The database and containers will be created automatically when you first run the app. To verify:

1. Run your backend:
   ```bash
   cd backend
   source venv/bin/activate
   pip install -r requirements.txt  # Install Azure dependencies
   python run.py
   ```

2. You should see:
   ```
   Azure Cosmos DB connection established successfully
   Database: sorryimissedthis
   Cosmos DB containers initialized
   ```

3. Check in Azure Portal:
   - Go to your Cosmos DB resource
   - Click "Data Explorer"
   - You should see database "sorryimissedthis" with containers: users, sessions, conversations, prompts

## Part 2: Deploy Backend to Azure App Service

### Option A: Deploy via Azure CLI (Recommended)

**Step 1: Create App Service Plan**

```bash
# Create Linux App Service Plan (Basic tier)
az appservice plan create \
  --name sorryimissedthis-plan \
  --resource-group sorryimissedthis-rg \
  --is-linux \
  --sku B1
```

**Step 2: Create Web App**

```bash
# Create Web App with Python 3.11
az webapp create \
  --resource-group sorryimissedthis-rg \
  --plan sorryimissedthis-plan \
  --name sorryimissedthis-api \
  --runtime "PYTHON:3.11" \
  --startup-file startup.sh
```

**Step 3: Configure Environment Variables**

```bash
# Get your Cosmos DB credentials first
COSMOS_ENDPOINT=$(az cosmosdb show --name sorryimissedthis-cosmos --resource-group sorryimissedthis-rg --query documentEndpoint -o tsv)
COSMOS_KEY=$(az cosmosdb keys list --name sorryimissedthis-cosmos --resource-group sorryimissedthis-rg --query primaryMasterKey -o tsv)

# Set all environment variables
az webapp config appsettings set \
  --resource-group sorryimissedthis-rg \
  --name sorryimissedthis-api \
  --settings \
    COSMOS_ENDPOINT="$COSMOS_ENDPOINT" \
    COSMOS_KEY="$COSMOS_KEY" \
    COSMOS_DATABASE="sorryimissedthis" \
    FLASK_ENV="production" \
    PORT="8000" \
    CORS_ORIGINS="https://your-frontend-domain.com,http://localhost:3000" \
    OPENAI_API_KEY="your-openai-api-key" \
    SECRET_KEY="$(openssl rand -hex 32)"
```

**Step 4: Deploy Code**

```bash
# From your project root
cd /Users/mpanojulesoreste/Documents/GitHub/SorryIMissedThis

# Deploy backend folder
az webapp up \
  --resource-group sorryimissedthis-rg \
  --name sorryimissedthis-api \
  --runtime "PYTHON:3.11" \
  --src-path backend
```

### Option B: Deploy via GitHub Actions

The `azure-deploy.yml` file is already configured. You just need to:

**Step 1: Get Publish Profile**

```bash
az webapp deployment list-publishing-profiles \
  --resource-group sorryimissedthis-rg \
  --name sorryimissedthis-api \
  --xml
```

**Step 2: Add to GitHub Secrets**

1. Copy the output from Step 1
2. Go to your GitHub repo → Settings → Secrets and variables → Actions
3. Create new secret: `AZURE_WEBAPP_PUBLISH_PROFILE`
4. Paste the publish profile

**Step 3: Move Workflow File**

```bash
mkdir -p .github/workflows
mv backend/azure-deploy.yml .github/workflows/
```

**Step 4: Push to GitHub**

```bash
git add .
git commit -m "Add Azure deployment"
git push origin main
```

### Option C: Deploy via VS Code

1. Install "Azure App Service" extension in VS Code
2. Sign in to Azure
3. Right-click on `backend` folder
4. Select "Deploy to Web App..."
5. Follow the prompts

## Part 3: Update Frontend Configuration

Update your frontend `.env`:

```env
VITE_API_URL=https://sorryimissedthis-api.azurewebsites.net/api
```

If testing locally with Azure Cosmos DB:

```env
VITE_API_URL=http://localhost:5002/api
```

## Part 4: Testing Your Setup

### Test Cosmos DB Connection

```bash
cd backend
source venv/bin/activate
python run.py
```

You should see:
```
Azure Cosmos DB connection established successfully
Database: sorryimissedthis
Cosmos DB containers initialized
```

### Test Registration API

```bash
curl -X POST https://sorryimissedthis-api.azurewebsites.net/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "user": {...},
    "token": "...",
    "refreshToken": "..."
  },
  "message": "User registered successfully"
}
```

### Verify in Cosmos DB

1. Go to Azure Portal → Your Cosmos DB
2. Click "Data Explorer"
3. Expand "sorryimissedthis" → "users"
4. You should see your test user!

## Cost Breakdown

### Azure Cosmos DB (Serverless)
- **First 1 million requests**: ~$0.25
- **Storage**: $0.25 per GB/month
- **Estimated monthly cost**: $1-5 for development

### Azure App Service (Basic B1)
- **Cost**: ~$13/month
- **Includes**: 1.75 GB RAM, 10 GB storage
- **Free tier**: Available for testing (fewer resources)

### Total Estimated Cost
- **Development**: $5-10/month
- **Production (low traffic)**: $15-20/month

## Troubleshooting

### "Database not configured" Error

**Problem**: Backend can't connect to Cosmos DB

**Solution**:
1. Check `.env` file has correct `COSMOS_ENDPOINT` and `COSMOS_KEY`
2. Verify the values match those in Azure Portal → Cosmos DB → Keys
3. Restart the backend server

### "Request rate is large" Error

**Problem**: Exceeded Cosmos DB throughput

**Solution**:
- This is rare with serverless mode
- If it happens, wait a minute and try again
- For production, consider provisioned throughput

### Deployment Fails

**Problem**: Azure deployment errors

**Solution**:
1. Check `requirements.txt` is in backend folder
2. Verify `startup.sh` is executable: `chmod +x startup.sh`
3. Check Azure App Service logs:
   ```bash
   az webapp log tail --name sorryimissedthis-api --resource-group sorryimissedthis-rg
   ```

### CORS Errors

**Problem**: Frontend can't connect to backend

**Solution**:
1. Update `CORS_ORIGINS` in Azure App Service settings
2. Include your frontend domain
3. Restart the web app

## Security Best Practices

### Production Checklist

- [ ] Change `SECRET_KEY` to a secure random string
- [ ] Set `FLASK_ENV=production`
- [ ] Update `CORS_ORIGINS` to only your frontend domain
- [ ] Enable HTTPS only in App Service
- [ ] Rotate Cosmos DB keys periodically
- [ ] Use Azure Key Vault for secrets (advanced)
- [ ] Enable App Service authentication (optional)
- [ ] Set up Application Insights for monitoring

### Secure Your Cosmos DB

1. Go to Azure Portal → Cosmos DB → Firewall and virtual networks
2. Select "Selected networks"
3. Add your App Service IP or enable "Allow access from Azure Portal"

## Next Steps

After setup:

1. **Test all endpoints**: Use the `test_auth.sh` script
2. **Monitor costs**: Azure Portal → Cost Management
3. **Set up CI/CD**: Use GitHub Actions for automatic deployment
4. **Add monitoring**: Enable Application Insights
5. **Scale as needed**: Upgrade App Service plan when traffic grows

## Useful Azure CLI Commands

```bash
# View all resources
az resource list --resource-group sorryimissedthis-rg --output table

# Stream logs
az webapp log tail --name sorryimissedthis-api --resource-group sorryimissedthis-rg

# Restart web app
az webapp restart --name sorryimissedthis-api --resource-group sorryimissedthis-rg

# Scale up
az appservice plan update --name sorryimissedthis-plan --resource-group sorryimissedthis-rg --sku S1

# Delete everything (careful!)
az group delete --name sorryimissedthis-rg --yes
```

## Additional Resources

- [Azure Cosmos DB Documentation](https://docs.microsoft.com/azure/cosmos-db/)
- [Azure App Service Python Guide](https://docs.microsoft.com/azure/app-service/quickstart-python)
- [Azure CLI Reference](https://docs.microsoft.com/cli/azure/)
- [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)

## Support

If you encounter issues:
1. Check Azure Portal → Activity Log for errors
2. View App Service logs
3. Verify all environment variables are set
4. Check that Cosmos DB is in the same region as App Service
