# Sorry I Missed This (SIMT)

A beautiful relationship management application that helps you nurture your connections through AI-powered insights and thoughtful prompts.

## 🌳 What is SIMT?

SIMT visualizes your relationships as a living grove, with you as the gardener at the center. Each relationship is represented as a leaf on a branch, with visual indicators showing:

- **Health Status**: Healthy (green), Attention (orange), Dormant (pink), At Risk (brown)
- **Branch Thickness**: Relationship closeness
- **Distance from Center**: Recency of contact
- **Leaf Size**: Interaction frequency

## ✨ Key Features

### 🎨 Beautiful Grove Visualization
- Interactive tree-of-life metaphor
- Real-time relationship health indicators
- Intuitive visual language for relationship status

### 🤖 AI-Powered Insights
- Conversation analysis and sentiment tracking
- Personalized message prompts
- Relationship health recommendations
- Smart follow-up suggestions

### 📱 Multi-Platform Integration
- WhatsApp Web integration
- Telegram support
- Privacy-first local processing
- Optional cloud sync

### 📊 Analytics & Trends
- Relationship health over time
- Communication patterns
- Growth rings visualization
- Topic diversity tracking

### 📅 Smart Scheduling
- Automated relationship maintenance
- Catch-up session planning
- Calendar integration
- Priority-based suggestions

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with Vite
- **UI Library**: Radix UI + Tailwind CSS
- **State Management**: React hooks
- **Styling**: Custom design system with nature metaphors

### Backend (Node.js + Express)
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB (Azure Cosmos DB)
- **Authentication**: JWT tokens
- **AI Integration**: OpenAI GPT-4

### Cloud Infrastructure (Azure)
- **App Service**: Host backend API
- **Cosmos DB**: MongoDB-compatible database
- **Storage Account**: File storage
- **Key Vault**: Secret management
- **CDN**: Static asset delivery

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Azure Cosmos DB)
- OpenAI API key
- Azure account (for production)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd SorryIMissedThis
```

### 2. Backend Setup
```bash
cd backend
npm install
cp env.example .env
```

Edit `.env` with your configuration:
```env
MONGODB_URI=mongodb://localhost:27017/simt
JWT_SECRET=your-super-secret-jwt-key
OPENAI_API_KEY=your-openai-api-key
FRONTEND_URL=http://localhost:5173
```

Start the backend:
```bash
npm run dev
```

### 3. Frontend Setup
```bash
cd FigmaFrontEnd
npm install
```

Create `.env.local`:
```env
VITE_API_URL=http://localhost:3000/api
```

Start the frontend:
```bash
npm run dev
```

### 4. Access the Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Health Check: http://localhost:3000/health

## 🏗️ Azure Deployment

### 1. Set Up Azure Resources
```bash
cd backend/scripts
chmod +x setup-azure.sh
./setup-azure.sh
```

### 2. Configure Secrets
```bash
# Add OpenAI API key
az keyvault secret set --vault-name simt-keyvault --name 'OpenAI-API-Key' --value 'your-key'

# Add Telegram bot token (optional)
az keyvault secret set --vault-name simt-keyvault --name 'Telegram-Bot-Token' --value 'your-token'
```

### 3. Deploy Backend
The GitHub Actions workflow will automatically deploy when you push to the main branch.

### 4. Deploy Frontend
Deploy the frontend to Azure Static Web Apps or your preferred hosting service.

## 🔧 Development

### Project Structure
```
SorryIMissedThis/
├── backend/                 # Node.js API
│   ├── src/
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── middleware/     # Express middleware
│   ├── scripts/            # Deployment scripts
│   └── azure-deploy.yml    # GitHub Actions
├── FigmaFrontEnd/          # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API client
│   │   └── styles/         # CSS and styling
│   └── package.json
└── README.md
```

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Sign in
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Sign out

#### Contacts
- `GET /api/contacts` - List contacts with filters
- `POST /api/contacts` - Create new contact
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact

#### AI Features
- `POST /api/ai/analyze-conversation` - Analyze conversation
- `POST /api/ai/generate-prompts` - Generate message prompts
- `GET /api/ai/suggestions/daily` - Get daily suggestions

#### Analytics
- `GET /api/analytics/overview` - Get analytics overview
- `GET /api/analytics/contacts/:id` - Contact-specific analytics
- `GET /api/analytics/trends` - Relationship trends

### Database Schema

#### Users
```typescript
{
  email: string;
  password: string; // hashed
  name: string;
  preferences: {
    privacy: { localOnly: boolean; cloudSync: boolean; dataRetention: number };
    notifications: { email: boolean; push: boolean; frequency: string };
    ai: { promptStyle: string; autoAnalysis: boolean };
  };
  connectedPlatforms: {
    whatsapp: { connected: boolean; sessionId?: string };
    telegram: { connected: boolean; userId?: string };
  };
}
```

#### Contacts
```typescript
{
  userId: ObjectId;
  name: string;
  category: 'family' | 'friends' | 'work';
  status: 'healthy' | 'attention' | 'dormant' | 'wilted';
  metrics: {
    totalMessages: number;
    lastContact: Date;
    reciprocity: number;
    interactionFrequency: number;
  };
  aiAnalysis: {
    personality: string;
    communicationStyle: string;
    preferredTopics: string[];
  };
}
```

## 🔒 Privacy & Security

### Data Protection
- **Local-First**: All data processed locally by default
- **Encryption**: Data encrypted at rest and in transit
- **No Message Sending**: AI suggests but never sends messages
- **User Control**: One-click data purge available

### Security Features
- JWT-based authentication
- Rate limiting on API endpoints
- CORS protection
- Input validation and sanitization
- Secure secret management with Azure Key Vault

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Design inspiration from nature and relationship psychology
- UI components from Radix UI
- Icons from Lucide React
- AI capabilities powered by OpenAI

## 📞 Support

For support, email support@simt.app or join our Discord community.

---

**Made with ❤️ by Wasu Industries**

