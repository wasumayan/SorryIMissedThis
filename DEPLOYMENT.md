# SIMT Deployment Guide

This guide walks you through deploying "Sorry I Missed This" to Azure.

## 🏗️ Azure Infrastructure Setup

### Prerequisites
- Azure CLI installed and configured
- GitHub repository with your code
- OpenAI API key
- Domain name (optional)

### 1. Create Azure Resources

Run the setup script to create all necessary Azure resources:

```bash
cd backend/scripts
chmod +x setup-azure.sh
./setup-azure.sh
```

This script creates:
- Resource Group: `simt-rg`
- App Service Plan: `simt-plan`
- Web App: `simt-backend`
- Cosmos DB: `simt-db`
- Storage Account: `simtstorage`
- Key Vault: `simt-keyvault`

### 2. Configure Secrets

Add your API keys to Azure Key Vault:

```bash
# OpenAI API Key
az keyvault secret set --vault-name simt-keyvault --name 'OpenAI-API-Key' --value 'your-openai-key'

# Telegram Bot Token (optional)
az keyvault secret set --vault-name simt-keyvault --name 'Telegram-Bot-Token' --value 'your-telegram-token'

# JWT Secret (generated automatically)
az keyvault secret show --vault-name simt-keyvault --name 'JWT-Secret' --query value -o tsv
```

### 3. Configure App Settings

Update your Web App settings:

```bash
# Get the MongoDB connection string
COSMOS_URI=$(az cosmosdb keys list --name simt-db --resource-group simt-rg --type connection-strings --query connectionStrings[0].connectionString -o tsv)

# Update app settings
az webapp config appsettings set \
  --name simt-backend \
  --resource-group simt-rg \
  --settings \
    NODE_ENV=production \
    MONGODB_URI="$COSMOS_URI" \
    FRONTEND_URL="https://your-frontend-domain.com"
```

## 🚀 Backend Deployment

### Option 1: GitHub Actions (Recommended)

1. **Set up GitHub Secrets**:
   - Go to your GitHub repository
   - Navigate to Settings → Secrets and variables → Actions
   - Add these secrets:
     - `AZUREAPPSERVICE_PUBLISHPROFILE`: Get from Azure Portal
     - `AZURE_RESOURCE_GROUP`: `simt-rg`
     - `MONGODB_URI`: Your Cosmos DB connection string
     - `JWT_SECRET`: Generated JWT secret
     - `OPENAI_API_KEY`: Your OpenAI API key
     - `FRONTEND_URL`: Your frontend URL

2. **Enable GitHub Actions**:
   - The workflow file is already configured in `backend/azure-deploy.yml`
   - Push to the main branch to trigger deployment

### Option 2: Manual Deployment

```bash
# Build the application
cd backend
npm install
npm run build

# Deploy using Azure CLI
az webapp deployment source config-zip \
  --resource-group simt-rg \
  --name simt-backend \
  --src package.zip
```

## 🌐 Frontend Deployment

### Option 1: Azure Static Web Apps

1. **Create Static Web App**:
```bash
az staticwebapp create \
  --name simt-frontend \
  --resource-group simt-rg \
  --source https://github.com/your-username/SorryIMissedThis \
  --location "Central US" \
  --branch main \
  --app-location "/FigmaFrontEnd" \
  --output-location "dist"
```

2. **Configure Environment Variables**:
   - Go to Azure Portal → Static Web Apps → simt-frontend
   - Navigate to Configuration → Application settings
   - Add: `VITE_API_URL=https://simt-backend.azurewebsites.net/api`

### Option 2: Vercel/Netlify

1. **Vercel**:
   - Connect your GitHub repository
   - Set build command: `npm run build`
   - Set output directory: `dist`
   - Add environment variable: `VITE_API_URL=https://simt-backend.azurewebsites.net/api`

2. **Netlify**:
   - Connect your GitHub repository
   - Set build command: `npm run build`
   - Set publish directory: `dist`
   - Add environment variable: `VITE_API_URL=https://simt-backend.azurewebsites.net/api`

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
NODE_ENV=production
MONGODB_URI=mongodb://simt-db:your-connection-string@simt-db.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb
JWT_SECRET=your-jwt-secret
OPENAI_API_KEY=your-openai-key
FRONTEND_URL=https://your-frontend-domain.com
```

#### Frontend (.env.local)
```env
VITE_API_URL=https://simt-backend.azurewebsites.net/api
```

### CORS Configuration

Ensure your backend allows requests from your frontend domain:

```bash
az webapp cors add \
  --name simt-backend \
  --resource-group simt-rg \
  --allowed-origins "https://your-frontend-domain.com"
```

## 📊 Monitoring & Logs

### Application Insights

1. **Enable Application Insights**:
```bash
az monitor app-insights component create \
  --app simt-backend \
  --location "East US" \
  --resource-group simt-rg
```

2. **View Logs**:
```bash
az webapp log tail --name simt-backend --resource-group simt-rg
```

### Health Checks

- Backend Health: `https://simt-backend.azurewebsites.net/health`
- Frontend: Your deployed frontend URL

## 🔒 Security Configuration

### SSL/TLS
- Azure App Service provides SSL by default
- Custom domains can be configured with SSL certificates

### Firewall Rules
```bash
# Restrict database access to App Service
az cosmosdb network-rule add \
  --name simt-db \
  --resource-group simt-rg \
  --subnet-id /subscriptions/your-subscription/resourceGroups/simt-rg/providers/Microsoft.Network/virtualNetworks/simt-vnet/subnets/default
```

### Key Vault Access
```bash
# Grant App Service access to Key Vault
az keyvault set-policy \
  --name simt-keyvault \
  --object-id $(az webapp identity show --name simt-backend --resource-group simt-rg --query principalId -o tsv) \
  --secret-permissions get list
```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**:
   - Check Cosmos DB connection string
   - Verify firewall rules
   - Ensure SSL is enabled

2. **CORS Errors**:
   - Verify frontend URL in CORS settings
   - Check environment variables

3. **Authentication Issues**:
   - Verify JWT secret is set correctly
   - Check token expiration settings

4. **AI Features Not Working**:
   - Verify OpenAI API key is valid
   - Check API quota and billing

### Debug Commands

```bash
# Check app settings
az webapp config appsettings list --name simt-backend --resource-group simt-rg

# View application logs
az webapp log download --name simt-backend --resource-group simt-rg

# Test database connection
az cosmosdb keys list --name simt-db --resource-group simt-rg --type connection-strings
```

## 📈 Scaling

### Horizontal Scaling
```bash
# Scale App Service Plan
az appservice plan update \
  --name simt-plan \
  --resource-group simt-rg \
  --sku P1V2
```

### Database Scaling
```bash
# Scale Cosmos DB throughput
az cosmosdb sql database throughput update \
  --account-name simt-db \
  --resource-group simt-rg \
  --name simt-database \
  --throughput 1000
```

## 🔄 CI/CD Pipeline

The GitHub Actions workflow automatically:
1. Runs tests
2. Builds the application
3. Deploys to Azure App Service
4. Updates app settings
5. Runs health checks

### Manual Deployment
```bash
# Trigger deployment manually
gh workflow run azure-deploy.yml
```

## 📋 Checklist

- [ ] Azure resources created
- [ ] Secrets configured in Key Vault
- [ ] App settings configured
- [ ] CORS configured
- [ ] Frontend deployed
- [ ] Domain configured (if using custom domain)
- [ ] SSL certificate installed
- [ ] Monitoring enabled
- [ ] Health checks passing
- [ ] End-to-end testing completed

## 🆘 Support

If you encounter issues:

1. Check the Azure Portal for error logs
2. Review the GitHub Actions workflow logs
3. Verify all environment variables are set correctly
4. Test the health endpoints
5. Contact support with specific error messages

---

**Happy Deploying! 🌳**

