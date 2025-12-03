# Sorry I Missed This - Codebase Deep Dive

## Executive Summary

**Sorry I Missed This (SIMT)** is a relationship management application that helps users maintain connections through AI-powered insights. The application visualizes relationships as a "grove" with contacts represented as leaves on branches, where visual properties indicate relationship health.

**Key Architecture Note**: The README mentions Node.js/Express, but the actual backend is **Python/Flask**. This is an important discrepancy to note.

---

## Architecture Overview

### Technology Stack

**Backend:**
- **Framework**: Flask (Python)
- **Database**: Azure Cosmos DB (MongoDB-compatible)
- **AI Service**: Azure OpenAI (GPT-4o-mini)
- **Runtime**: Python 3.9+
- **Deployment**: Azure App Service

**Frontend:**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Radix UI + Tailwind CSS
- **State Management**: React Hooks
- **Animation**: Motion (Framer Motion)

**Cloud Infrastructure:**
- Azure App Service (backend hosting)
- Azure Cosmos DB (database)
- Azure Key Vault (secrets management)
- Azure OpenAI (AI services)

---

## Data Flow & Core Concepts

### 1. Data Model Hierarchy

```
User
  └── Conversations (stored in Cosmos DB as "conversations" container)
       ├── Messages (embedded in conversation)
       ├── Metrics (calculated from messages)
       └── Prompts (AI-generated, stored in "prompts" container)
```

**Important**: In this codebase, "Contacts" and "Conversations" are essentially the same thing. Contacts are derived from conversations - there's no separate contacts table. When you upload a chat transcript, it creates conversations, which are then displayed as contacts in the UI.

### 2. Key Data Models

#### User (`app/models/user.py`)
- Stores user authentication and preferences
- Contains privacy settings, notification preferences, AI preferences
- Tracks connected platforms (WhatsApp, Telegram)

#### Conversation (`app/models/__init__.py`)
- Represents a relationship with one person
- Contains:
  - `partner_name`: The other person's name
  - `messages`: List of Message objects
  - `metrics`: ConversationMetrics object
  - `category`: "family", "friends", or "work"
  - `status`: "healthy", "attention", "dormant", or "wilted" (calculated)

#### Message (`app/models/__init__.py`)
- Individual chat message
- Contains: timestamp, sender, content
- Parsed from WhatsApp chat exports

#### ConversationMetrics
- Calculated analytics:
  - `total_messages`, `user_messages`, `partner_messages`
  - `reciprocity`: Balance of conversation (0-1)
  - `avg_response_time`: Average time between messages (hours)
  - `days_since_contact`: Days since last message
  - `common_topics`: Extracted keywords from messages

#### ConversationPrompt
- AI-generated message suggestions
- Contains: prompt text, type, context, confidence score

---

## Backend Architecture

### Application Structure

```
backend/
├── app/
│   ├── __init__.py          # Flask app factory
│   ├── config.py            # Configuration management
│   ├── models/              # Data models
│   ├── routes/              # API endpoints (blueprints)
│   │   ├── auth.py          # Authentication
│   │   ├── upload.py        # Chat transcript upload
│   │   ├── recommendations.py  # AI prompt generation
│   │   ├── conversations.py # Conversation management
│   │   ├── contacts.py      # Contact CRUD (derived from conversations)
│   │   ├── analytics.py     # Analytics endpoints
│   │   ├── ai.py            # AI analysis endpoints
│   │   └── schedule.py      # Scheduling features
│   ├── services/            # Business logic
│   │   ├── azure_storage.py # Cosmos DB operations
│   │   ├── ai_service.py    # OpenAI integration
│   │   ├── chat_parser.py   # WhatsApp parsing
│   │   └── analytics.py     # Analytics calculations
│   └── utils/               # Helper functions
│       ├── azure_openai.py  # Azure OpenAI client
│       └── helpers.py       # General utilities
├── run.py                   # Application entry point
└── requirements.txt         # Python dependencies
```

### Key Services

#### AzureStorageService (`app/services/azure_storage.py`)
- **Singleton pattern** - ensures single Cosmos DB connection
- Manages 4 containers:
  - `users`: User accounts
  - `sessions`: Authentication sessions
  - `conversations`: All conversations (these become contacts)
  - `prompts`: AI-generated prompts
- Handles CRUD operations for all entities
- Falls back to "mock mode" if Cosmos DB not configured

#### AIService (`app/services/ai_service.py`)
- Generates conversation prompts using Azure OpenAI
- Uses conversation context (last 20 messages)
- Considers relationship health for prompt type:
  - `at_risk` → reconnection prompts
  - `dormant` → gentle check-ins
  - `attention` → maintenance prompts
  - `healthy` → natural continuation
- Falls back to template-based prompts if API unavailable

#### ChatParser (`app/services/chat_parser.py`)
- Parses WhatsApp chat exports (.txt or .zip)
- Handles multiple date formats and message patterns
- Filters system messages (group changes, media omitted, etc.)
- Supports group chats (creates individual conversations per person)
- Calculates metrics:
  - Reciprocity (message balance)
  - Average response time
  - Days since contact
  - Common topics (simple keyword extraction)

### API Endpoints

#### Authentication (`/api/auth/*`)
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Sign out

**Auth Flow:**
1. User registers/logs in
2. Server creates session in Cosmos DB
3. Returns token (stored in localStorage on frontend)
4. Token validated on subsequent requests via `/api/auth/me`

#### Upload (`/api/upload/*`)
- `POST /api/upload/transcript` - Upload WhatsApp chat export
  - Accepts .txt or .zip files
  - Parses messages using ChatParser
  - Creates Conversation objects
  - Saves to Cosmos DB
  - Returns summary of processed conversations

#### Contacts (`/api/contacts/*`)
- `GET /api/contacts` - List contacts (derived from conversations)
- `POST /api/contacts` - Create new contact (creates empty conversation)
- `GET /api/contacts/:id` - Get contact details
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact

**Note**: Contacts are essentially conversations with metadata. The contacts endpoint queries the conversations container and transforms them into contact objects.

#### Recommendations (`/api/recommendations`)
- `GET /api/recommendations` - Get AI-generated prompts
  - Queries conversations for user
  - Generates prompts using AIService
  - Returns 3 prompts per conversation
  - Supports mock data for testing

#### Conversations (`/api/conversations/*`)
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/:id` - Get conversation details
- `GET /api/conversations/:id/summary` - Get AI summary

#### Analytics (`/api/analytics/*`)
- `GET /api/analytics/overview` - Overall analytics
- `GET /api/analytics/contacts/:id` - Contact-specific analytics
- `GET /api/analytics/trends` - Relationship trends over time

---

## Frontend Architecture

### Application Structure

```
FigmaFrontEnd/
├── src/
│   ├── App.tsx              # Main app component (view router)
│   ├── main.tsx             # React entry point
│   ├── services/
│   │   └── api.ts           # API client (all backend calls)
│   ├── components/
│   │   ├── GroveDashboard.tsx    # Main grove visualization
│   │   ├── GroveLeaf.tsx         # Individual leaf component
│   │   ├── ConversationView.tsx  # Conversation detail view
│   │   ├── Analytics.tsx         # Analytics dashboard
│   │   ├── Schedule.tsx          # Scheduling view
│   │   ├── Settings.tsx          # User settings
│   │   ├── Onboarding.tsx        # First-time setup
│   │   └── ui/                   # Radix UI components
│   └── styles/
│       └── globals.css      # Global styles
└── vite.config.ts
```

### View Flow

```
Onboarding → Grove Dashboard → [Conversation View | Analytics | Schedule | Settings]
```

1. **Onboarding**: First-time user registration/login
2. **Grove Dashboard**: Main view showing all contacts as leaves
3. **Conversation View**: Detailed view of a specific contact
4. **Analytics**: Relationship analytics and trends
5. **Schedule**: Scheduled prompts and catch-up suggestions
6. **Settings**: User preferences and configuration

### Grove Visualization

The core visualization (`GroveDashboard.tsx`) renders contacts as leaves on branches:

**Visual Properties:**
- **Leaf Color**: Relationship health
  - Green: Healthy (recent contact)
  - Orange: Needs Attention (14-30 days)
  - Pink: Dormant (30-60 days, shown as bud)
  - Brown: At Risk/Wilted (60+ days)
- **Branch Thickness**: Relationship closeness (reciprocity)
- **Branch Length**: Recency of contact (distance from center)
- **Leaf Size**: Interaction frequency (total messages)
- **Position**: Calculated using force-directed layout

**Layout Algorithm:**
- Uses force-directed graph layout
- Center point: (500, 350) - represents "You"
- Each contact positioned based on:
  - Recency (distance from center)
  - Closeness (angle)
  - Avoids overlaps

### API Client (`services/api.ts`)

Centralized API client that:
- Manages authentication tokens (localStorage)
- Provides typed interfaces for all API calls
- Handles errors and response formatting
- Exports TypeScript interfaces for all data types

---

## Data Flow Examples

### Example 1: Uploading a Chat Transcript

```
1. User uploads WhatsApp .txt file via frontend
   ↓
2. POST /api/upload/transcript
   ↓
3. ChatParser.parse_chat_file()
   - Parses messages from text
   - Identifies senders
   - Filters system messages
   ↓
4. ChatParser.create_conversation() or create_conversations_from_group()
   - Creates Conversation object
   - Calculates metrics (reciprocity, response time, etc.)
   - Determines relationship health
   ↓
5. AzureStorageService.create_conversation()
   - Saves to Cosmos DB "conversations" container
   ↓
6. Returns success with conversation IDs
   ↓
7. Frontend refreshes contacts list
   - GET /api/contacts
   - Displays new contacts in grove
```

### Example 2: Getting AI Prompts

```
1. User clicks on a contact leaf
   ↓
2. Frontend calls GET /api/recommendations?userId=...&conversationId=...
   ↓
3. Recommendations route:
   - Fetches conversation from Cosmos DB
   - Converts to Conversation model
   ↓
4. AIService.generate_prompts()
   - Prepares context (last 20 messages)
   - Determines prompt focus based on health
   ↓
5. AIService._call_azure_openai()
   - Calls Azure OpenAI API
   - System prompt: Instructions for generating prompts
   - User prompt: Conversation context
   ↓
6. Parses JSON response
   - Extracts prompt text, type, context, confidence
   ↓
7. Returns prompts to frontend
   ↓
8. Frontend displays prompts in ConversationView
```

### Example 3: Relationship Health Calculation

```
Conversation.get_relationship_health():

if days_since_contact > 60:
    return "wilted"      # Brown leaf, at risk
elif days_since_contact > 30:
    return "dormant"     # Pink bud, needs attention
elif days_since_contact > 14:
    return "attention"   # Orange leaf, getting stale
else:
    return "healthy"     # Green leaf, active
```

---

## Key Design Patterns

### 1. Application Factory Pattern
- Flask app created via `create_app()` function
- Allows different configurations (dev, prod, test)
- Blueprints registered dynamically

### 2. Singleton Pattern
- `AzureStorageService` uses singleton to ensure single DB connection
- Prevents connection pool exhaustion

### 3. Service Layer Pattern
- Business logic separated from routes
- Services handle complex operations
- Routes are thin controllers

### 4. Data Model Pattern
- Dataclasses for type safety
- `to_dict()` / `from_dict()` for serialization
- Handles both snake_case (backend) and camelCase (frontend)

### 5. Fallback Pattern
- AI service falls back to template prompts if API unavailable
- Storage service falls back to mock mode if DB unavailable
- Graceful degradation

---

## Configuration

### Environment Variables

**Backend (.env):**
```env
# Azure Cosmos DB
COSMOS_ENDPOINT=https://...
COSMOS_KEY=...
COSMOS_DATABASE=sorryimissedthis

# Azure OpenAI
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://...
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Flask
FLASK_ENV=development
PORT=5002
SECRET_KEY=...
CORS_ORIGINS=http://localhost:5173
```

**Frontend (.env.local):**
```env
VITE_API_URL=http://localhost:5002/api
```

---

## Database Schema (Cosmos DB)

### Containers

1. **users**
   - Partition Key: `/id`
   - Fields: id, name, email, password (hashed), preferences, connectedPlatforms

2. **sessions**
   - Partition Key: `/userId`
   - Fields: id, userId, token, refreshToken, expiresAt

3. **conversations**
   - Partition Key: `/userId`
   - Fields: id, userId, partnerName, messages[], metrics{}, category, status, etc.
   - **Note**: This is the primary data container - contacts are derived from here

4. **prompts**
   - Partition Key: `/conversationId`
   - Fields: id, conversationId, promptText, promptType, context, confidenceScore

---

## AI Integration

### Azure OpenAI Usage

**Model**: GPT-4o-mini (configurable)

**Use Cases:**
1. **Prompt Generation**: Creates context-aware conversation prompts
2. **Conversation Analysis**: (Future) Sentiment analysis, topic extraction
3. **Relationship Insights**: (Future) Communication pattern analysis

**Prompt Engineering:**
- System message defines role and requirements
- User message contains conversation context
- Response format: JSON array of prompts
- Includes confidence scores and context explanations

**Fallback:**
- Template-based prompts if API unavailable
- Lower confidence scores for fallback prompts

---

## Security & Privacy

### Authentication
- Token-based (stored in localStorage)
- Sessions stored in Cosmos DB
- Password hashing: SHA-256 (consider upgrading to bcrypt)

### Data Privacy
- Local-first processing (chat parsing happens server-side but could be client-side)
- No message sending (AI only suggests)
- User controls data retention
- PII filtering in chat parser (phone numbers, emails)

### CORS
- Configured for specific origins
- Supports credentials

---

## Known Issues & Discrepancies

1. **README vs Reality**: README says Node.js/Express, but backend is Python/Flask
2. **Password Hashing**: Uses SHA-256 (should use bcrypt/argon2)
3. **Token Validation**: Basic implementation (could use JWT properly)
4. **Error Handling**: Some routes have basic error handling
5. **Testing**: Limited test coverage
6. **Type Safety**: Backend uses dataclasses but no type checking (mypy)

---

## Development Workflow

### Running Locally

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py
```

**Frontend:**
```bash
cd FigmaFrontEnd
npm install
npm run dev
```

### Deployment

- Backend: Azure App Service (via GitHub Actions)
- Frontend: Static hosting (Azure Static Web Apps or similar)
- Database: Azure Cosmos DB
- Secrets: Azure Key Vault

---

## Future Enhancements (From Code Comments)

1. **Sentiment Analysis**: Analyze message sentiment
2. **Response Timing**: Suggest optimal times to reach out
3. **Topic Extraction**: Better NLP for topic identification
4. **Relationship Categorization**: AI-powered category detection
5. **Calendar Integration**: Schedule prompts in calendar
6. **Multi-platform Sync**: Real-time WhatsApp/Telegram integration
7. **Growth Rings**: Visualize relationship history over time

---

## Key Takeaways

1. **Contacts = Conversations**: There's no separate contacts table - contacts are conversations with metadata
2. **Visual Metaphor**: The grove visualization is the core UX - everything revolves around it
3. **AI-Powered**: The app uses AI to generate context-aware prompts, not just generic suggestions
4. **Privacy-First**: Designed to process data locally, with optional cloud sync
5. **Relationship Health**: Automatically calculated based on recency and interaction patterns
6. **Group Chat Support**: Can parse group chats and create individual conversations per person

---

## Code Quality Notes

**Strengths:**
- Clean separation of concerns (routes, services, models)
- Type hints in Python
- TypeScript on frontend
- Good error handling in most places
- Comprehensive data models

**Areas for Improvement:**
- Add unit tests
- Improve password hashing
- Add input validation middleware
- Better error messages
- Add logging/monitoring
- Update README to reflect actual stack

---

This overview should give you a comprehensive understanding of how the codebase functions. The architecture is well-structured with clear separation between frontend and backend, and the data flow is logical and straightforward.

