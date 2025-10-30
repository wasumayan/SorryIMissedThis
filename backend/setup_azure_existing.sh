#!/bin/bash

# Azure Cosmos DB Setup Script for Sorry I Missed This
# Using existing Azure subscription and resource group

set -e

echo "=================================="
echo "Sorry I Missed This - Azure Setup"
echo "Using Existing Azure Resources"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Your existing Azure resources
SUBSCRIPTION_ID="3ED49111-5CFE-49C4-8B05-31400A1B784A"
RESOURCE_GROUP="COS-cos436fall25_team02-budget-rg"

echo "Using your existing resources:"
echo "  Subscription: $SUBSCRIPTION_ID"
echo "  Resource Group: $RESOURCE_GROUP"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}Azure CLI not found!${NC}"
    echo ""
    echo "Please install Azure CLI:"
    echo "  macOS: brew install azure-cli"
    echo "  Or visit: https://docs.microsoft.com/cli/azure/install-azure-cli"
    exit 1
fi

# Login to Azure
echo -e "${BLUE}Step 1: Logging into Azure...${NC}"
az login

# Set subscription
echo ""
echo -e "${BLUE}Step 2: Setting subscription...${NC}"
az account set --subscription "$SUBSCRIPTION_ID"
echo -e "${GREEN}✓ Subscription set${NC}"

# Check if resource group exists
echo ""
echo -e "${BLUE}Step 3: Verifying resource group...${NC}"
if az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    echo -e "${GREEN}✓ Resource group exists${NC}"
    LOCATION=$(az group show --name "$RESOURCE_GROUP" --query location -o tsv)
    echo "  Location: $LOCATION"
else
    echo -e "${RED}✗ Resource group not found${NC}"
    echo "Creating resource group..."
    LOCATION="eastus"
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
    echo -e "${GREEN}✓ Resource group created${NC}"
fi

# Create Cosmos DB account
echo ""
echo -e "${BLUE}Step 4: Creating Azure Cosmos DB account...${NC}"
echo "This will take 3-5 minutes..."

COSMOS_ACCOUNT="sorryimissedthis-db"
echo "Account name: $COSMOS_ACCOUNT"
echo ""

# Check if Cosmos DB account already exists
if az cosmosdb show --name "$COSMOS_ACCOUNT" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    echo -e "${YELLOW}Cosmos DB account already exists. Using existing account.${NC}"
else
    echo "Creating new Cosmos DB account (serverless mode)..."
    az cosmosdb create \
      --name "$COSMOS_ACCOUNT" \
      --resource-group "$RESOURCE_GROUP" \
      --kind GlobalDocumentDB \
      --locations regionName="$LOCATION" failoverPriority=0 \
      --default-consistency-level Session \
      --enable-automatic-failover false \
      --capabilities EnableServerless

    echo -e "${GREEN}✓ Cosmos DB account created${NC}"
fi

# Get Cosmos DB credentials
echo ""
echo -e "${BLUE}Step 5: Getting Cosmos DB credentials...${NC}"

COSMOS_ENDPOINT=$(az cosmosdb show --name "$COSMOS_ACCOUNT" --resource-group "$RESOURCE_GROUP" --query documentEndpoint -o tsv)
COSMOS_KEY=$(az cosmosdb keys list --name "$COSMOS_ACCOUNT" --resource-group "$RESOURCE_GROUP" --query primaryMasterKey -o tsv)

echo -e "${GREEN}✓ Credentials retrieved${NC}"

# Update .env file
echo ""
echo -e "${BLUE}Step 6: Updating .env file...${NC}"

ENV_FILE=".env"

if [ -f "$ENV_FILE" ]; then
    echo "Backing up existing .env to .env.backup"
    cp "$ENV_FILE" "$ENV_FILE.backup"
fi

# Get existing OpenAI key if available
EXISTING_OPENAI_KEY="your-openai-api-key-here"
if [ -f "$ENV_FILE.backup" ]; then
    EXISTING_OPENAI_KEY=$(grep "OPENAI_API_KEY=" "$ENV_FILE.backup" | cut -d'=' -f2)
fi

cat > "$ENV_FILE" << EOF
# Azure Cosmos DB Configuration
COSMOS_ENDPOINT=$COSMOS_ENDPOINT
COSMOS_KEY=$COSMOS_KEY
COSMOS_DATABASE=sorryimissedthis

# OpenAI Configuration
OPENAI_API_KEY=$EXISTING_OPENAI_KEY

# Flask Configuration
FLASK_ENV=development
PORT=5002
CORS_ORIGINS=http://localhost:3000
SECRET_KEY=$(openssl rand -hex 32)
EOF

echo -e "${GREEN}✓ .env file updated${NC}"

# Install dependencies
echo ""
echo -e "${BLUE}Step 7: Installing Python dependencies...${NC}"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo -e "${GREEN}✓ Dependencies installed${NC}"

# Summary
echo ""
echo "=================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=================================="
echo ""
echo "Your Azure resources:"
echo "  Subscription ID: $SUBSCRIPTION_ID"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Cosmos DB Account: $COSMOS_ACCOUNT"
echo "  Database: sorryimissedthis"
echo "  Location: $LOCATION"
echo ""
echo "Database endpoint:"
echo "  $COSMOS_ENDPOINT"
echo ""
echo "Next steps:"
echo "  1. Update OPENAI_API_KEY in .env if needed"
echo "  2. Run the backend:"
echo "     source venv/bin/activate"
echo "     python run.py"
echo "  3. Test it: ./test_auth.sh"
echo ""
echo "View your Cosmos DB:"
echo "  https://portal.azure.com/#@/resource/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.DocumentDB/databaseAccounts/$COSMOS_ACCOUNT"
echo ""
echo -e "${YELLOW}Note: Serverless Cosmos DB is free for the first 400 RU/s + 25 GB!${NC}"
echo ""
