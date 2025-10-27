#!/bin/bash

# Azure Infrastructure Setup Script for SIMT Backend
# This script sets up the necessary Azure resources for the SIMT application

set -e

# Configuration
RESOURCE_GROUP="simt-rg"
LOCATION="East US"
APP_SERVICE_PLAN="simt-plan"
WEB_APP_NAME="simt-backend"
COSMOS_DB_NAME="simt-db"
STORAGE_ACCOUNT="simtstorage"
KEY_VAULT="simt-keyvault"

echo "🚀 Setting up Azure infrastructure for SIMT..."

# Create resource group
echo "📦 Creating resource group..."
az group create \
  --name $RESOURCE_GROUP \
  --location "$LOCATION"

# Create App Service Plan
echo "📋 Creating App Service Plan..."
az appservice plan create \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --location "$LOCATION" \
  --sku B1 \
  --is-linux

# Create Web App
echo "🌐 Creating Web App..."
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --name $WEB_APP_NAME \
  --runtime "NODE|18-lts"

# Create Cosmos DB (MongoDB API)
echo "🗄️ Creating Cosmos DB..."
az cosmosdb create \
  --resource-group $RESOURCE_GROUP \
  --name $COSMOS_DB_NAME \
  --kind MongoDB \
  --locations regionName="$LOCATION" failoverPriority=0 isZoneRedundant=False \
  --default-consistency-level Session \
  --enable-multiple-write-locations false

# Create storage account
echo "💾 Creating storage account..."
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location "$LOCATION" \
  --sku Standard_LRS

# Create Key Vault
echo "🔐 Creating Key Vault..."
az keyvault create \
  --name $KEY_VAULT \
  --resource-group $RESOURCE_GROUP \
  --location "$LOCATION"

# Get connection strings and keys
echo "🔑 Retrieving connection information..."

# Get Cosmos DB connection string
COSMOS_CONNECTION_STRING=$(az cosmosdb keys list \
  --name $COSMOS_DB_NAME \
  --resource-group $RESOURCE_GROUP \
  --type connection-strings \
  --query connectionStrings[0].connectionString \
  --output tsv)

# Get storage account key
STORAGE_KEY=$(az storage account keys list \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query [0].value \
  --output tsv)

# Store secrets in Key Vault
echo "🔒 Storing secrets in Key Vault..."

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Store secrets
az keyvault secret set \
  --vault-name $KEY_VAULT \
  --name "MongoDB-ConnectionString" \
  --value "$COSMOS_CONNECTION_STRING"

az keyvault secret set \
  --vault-name $KEY_VAULT \
  --name "Storage-Account-Key" \
  --value "$STORAGE_KEY"

az keyvault secret set \
  --vault-name $KEY_VAULT \
  --name "JWT-Secret" \
  --value "$JWT_SECRET"

# Configure Web App settings
echo "⚙️ Configuring Web App settings..."

az webapp config appsettings set \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    NODE_ENV=production \
    MONGODB_URI="$COSMOS_CONNECTION_STRING" \
    JWT_SECRET="$JWT_SECRET" \
    FRONTEND_URL="https://simt-frontend.azurewebsites.net"

# Enable CORS for the Web App
echo "🌐 Configuring CORS..."
az webapp cors add \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --allowed-origins "https://simt-frontend.azurewebsites.net" "http://localhost:5173"

# Create deployment slot for staging
echo "🎭 Creating staging slot..."
az webapp deployment slot create \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --slot staging

# Output summary
echo "✅ Azure infrastructure setup complete!"
echo ""
echo "📋 Resource Summary:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Web App: https://$WEB_APP_NAME.azurewebsites.net"
echo "  Cosmos DB: $COSMOS_DB_NAME"
echo "  Storage Account: $STORAGE_ACCOUNT"
echo "  Key Vault: $KEY_VAULT"
echo ""
echo "🔑 Next Steps:"
echo "  1. Add your OpenAI API key to Key Vault:"
echo "     az keyvault secret set --vault-name $KEY_VAULT --name 'OpenAI-API-Key' --value 'your-key'"
echo ""
echo "  2. Update your frontend to use the backend URL:"
echo "     https://$WEB_APP_NAME.azurewebsites.net"
echo ""
echo "  3. Deploy your application using the GitHub Actions workflow"

