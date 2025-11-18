# Sorry I Missed This - Complete Codebase Explanation

## 🎯 What This Application Does

**Sorry I Missed This (SIMT)** is a relationship management application that helps users maintain connections with friends, family, and colleagues through:

1. **Visual Relationship Dashboard**: A "grove" visualization where each contact is a leaf on a branch, with visual properties indicating relationship health
2. **AI-Powered Conversation Prompts**: Context-aware message suggestions generated using Azure OpenAI
3. **Real-Time Message Integration**: Direct integration with iMessage on macOS via Photon SDK
4. **Analytics & Insights**: Track relationship health, communication patterns, and interaction frequency
5. **Research Study Integration**: Built-in 3-condition research experiment to study the impact of AI prompts on relationship quality

---

## 🏗️ Architecture Overview

### Technology Stack

**Backend:**
- **Framework**: Flask (Python 3.9+)
- **Database**: Azure Cosmos DB (MongoDB-compatible NoSQL)
- **AI Service**: Azure OpenAI (GPT-4o-mini)
- **Deployment**: Azure App Service
- **Real-Time Integration**: Photon SDK bridge server (Node.js)

**Frontend:**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Radix UI + Tailwind CSS
- **Animation**: Framer Motion
- **State Management**: React Hooks

**Infrastructure:**
- Azure Cosmos DB (database)
- Azure App Service (backend hosting)
- Azure Key Vault (secrets management)
- Azure OpenAI (AI services)

---

## 📊 Data Model & Structure

### Core Concept: Conversations = Contacts

**Important**: In this system, there is **no separate contacts table**. Contacts are derived from conversations. When you upload a chat transcript or sync iMessage, it creates **Conversation** objects, which are then displayed as contacts in the UI.

### Data Hierarchy

```
User
  └── Conversations (stored in Cosmos DB "conversations" container)
       ├── Messages (embedded in conversation, but NOT stored in cloud for privacy)
       ├── Metrics (calculated from messages)
       └── Prompts (AI-generated, stored in "prompts" container)
```

### Database Containers (Cosmos DB)

1. **`users`** - User accounts
   - Partition Key: `/id`
   - Fields: id, name, email, password (hashed), preferences, connectedPlatforms

2. **`sessions`** - Authentication sessions
   - Partition Key: `/userId`
   - Fields: id, userId, token, refreshToken, expiresAt

3. **`conversations`** - All conversations (these become contacts)
   - Partition Key: `/userId`
   - Fields: id, userId, partnerName, messages[] (metadata only, no content), metrics{}, category, status
   - **Privacy Note**: Message content is NOT stored in cloud - only metadata (count, timestamps)

4. **`prompts`** - AI-generated prompts
   - Partition Key: `/conversationId`
   - Fields: id, conversationId, promptText, promptType, context, confidenceScore

5. **`study_participants`** - Research study participants
   - Partition Key: `/userId`
   - Fields: participant data, condition assignments, survey responses

6. **`study_metrics`** - Research metrics
   - Partition Key: `/userId`
   - Fields: message metrics, prompt usage, edit rates

---

## 🔄 How Data Flows Through the System

### Example 1: User Registration & First Login

```
1. User visits frontend → Onboarding component
   ↓
2. User enters name, email, password
   ↓
3. POST /api/auth/register
   ↓
4. Backend (auth.py):
   - Validates input
   - Hashes password (SHA-256)
   - Creates User object
   - Stores in Cosmos DB "users" container
   - Creates session in "sessions" container
   - Returns token
   ↓
5. Frontend stores token in localStorage
   ↓
6. User redirected to Grove Dashboard
```

### Example 2: iMessage Integration & Sync

```
1. User clicks "Connect iMessage" in Settings
   ↓
2. POST /api/imessage/connect
   ↓
3. Backend (imessage.py):
   - Connects to Photon bridge server (localhost:4000)
   - Gets user's iMessage account from Photon
   - Auto-creates or finds user based on iMessage account
   - Returns user data + token
   ↓
4. User clicks "Sync Messages"
   ↓
5. POST /api/imessage/sync
   ↓
6. Backend:
   - Calls Photon SDK to get all chats
   - For each chat:
     * Extracts messages
     * Identifies partner name (from messages or contacts)
     * Creates/updates Conversation object
     * Calculates metrics (reciprocity, response time, etc.)
     * Stores in Cosmos DB (metadata only, no message content)
   ↓
7. Frontend refreshes contacts list
   ↓
8. Conversations appear as leaves in Grove Dashboard
```

### Example 3: Getting AI Prompts

```
1. User clicks on a contact leaf in Grove Dashboard
   ↓
2. Frontend navigates to ConversationView
   ↓
3. GET /api/conversations/{id}/prompts
   ↓
4. Backend (conversations.py):
   - Fetches conversation from Cosmos DB
   - Gets last 20 messages from iMessage (via Photon)
   - Calls AIService.generate_prompts()
   ↓
5. AIService (ai_service.py):
   - Analyzes user's texting style (emoji usage, punctuation, formality)
   - Prepares conversation context (last 20 messages)
   - Determines relationship health (healthy/attention/dormant/wilted)
   - Calls Azure OpenAI API with:
     * System prompt: Instructions for generating context-aware prompts
     * User prompt: Conversation history + relationship context
   - Parses JSON response (array of prompts)
   - Creates ConversationPrompt objects
   - Stores prompts in Cosmos DB
   ↓
6. Returns prompts to frontend
   ↓
7. Frontend displays prompts in ConversationView
   ↓
8. User can:
   - Send prompt as-is
   - Edit prompt before sending
   - Dismiss prompt
```

### Example 4: Real-Time Message Listening

```
1. User enables real-time listening
   ↓
2. Photon bridge server (photon-server/server.js) watches iMessage
   ↓
3. New message arrives in iMessage
   ↓
4. Photon SDK detects it → emits "new-message" event
   ↓
5. Bridge server receives event → POST /api/imessage/webhook
   ↓
6. Backend (imessage.py):
   - Extracts message data (chatGuid, text, sender, timestamp)
   - Finds or creates conversation
   - Updates conversation metrics
   - Triggers AI analysis if needed
   ↓
7. Frontend can poll or use WebSocket to get updates
```

---

## 🧩 Key Components Explained

### Backend Structure

```
backend/
├── app/
│   ├── __init__.py          # Flask app factory (creates app, registers blueprints)
│   ├── config.py            # Configuration management (dev/prod/test)
│   ├── models/              # Data models (dataclasses)
│   │   ├── __init__.py      # Conversation, Message, ConversationMetrics, ConversationPrompt, User
│   │   ├── user.py          # User model (empty, defined in __init__.py)
│   │   ├── message.py       # Message model (empty, defined in __init__.py)
│   │   └── study.py         # StudyParticipant, StudyMetrics, SurveyResponse
│   ├── routes/              # API endpoints (Flask blueprints)
│   │   ├── auth.py          # Registration, login, logout, purge data
│   │   ├── conversations.py # Get conversations, prompts, summaries
│   │   ├── contacts.py      # CRUD for contacts (derived from conversations)
│   │   ├── upload.py        # Upload WhatsApp chat exports (legacy)
│   │   ├── recommendations.py # AI prompt generation (legacy, now in conversations)
│   │   ├── analytics.py     # Analytics endpoints
│   │   ├── ai.py            # AI analysis endpoints
│   │   ├── schedule.py      # Scheduling features
│   │   ├── imessage.py      # iMessage integration (connect, sync, send, webhook)
│   │   ├── users.py         # User preferences management
│   │   └── study.py         # Research study endpoints
│   ├── services/            # Business logic
│   │   ├── azure_storage.py # Cosmos DB operations (singleton pattern)
│   │   ├── ai_service.py    # Azure OpenAI integration, prompt generation
│   │   ├── chat_parser.py  # WhatsApp export parsing (legacy)
│   │   ├── imessage_service.py # Photon SDK integration
│   │   └── name_inference.py # AI-powered name extraction
│   └── utils/               # Helper functions
│       ├── azure_openai.py  # Azure OpenAI client wrapper
│       └── helpers.py       # General utilities
└── run.py                   # Application entry point
```

### Frontend Structure

```
FigmaFrontEnd/
├── src/
│   ├── App.tsx              # Main app component (view router, state management)
│   ├── main.tsx             # React entry point
│   ├── services/
│   │   └── api.ts           # API client (all backend calls, TypeScript interfaces)
│   ├── components/
│   │   ├── GroveDashboard.tsx    # Main grove visualization
│   │   ├── GroveLeaf.tsx         # Individual leaf component
│   │   ├── ConversationView.tsx   # Conversation detail view with prompts
│   │   ├── Analytics.tsx         # Analytics dashboard
│   │   ├── Schedule.tsx          # Scheduling view
│   │   ├── Settings.tsx         # User settings
│   │   ├── Onboarding.tsx       # First-time setup
│   │   ├── StudyEnrollment.tsx  # Research study enrollment
│   │   ├── StudyStatusBanner.tsx # Study progress banner
│   │   ├── PostConditionSurvey.tsx # Post-condition survey
│   │   └── ui/                   # Radix UI components (buttons, cards, etc.)
│   └── styles/
│       └── globals.css      # Global styles
```

---

## 🔑 Key Services & Their Roles

### 1. AzureStorageService (`app/services/azure_storage.py`)

**Purpose**: Manages all database operations with Azure Cosmos DB

**Key Features:**
- **Singleton Pattern**: Ensures single DB connection (prevents connection pool exhaustion)
- **Mock Mode**: Falls back to in-memory storage if Cosmos DB not configured
- **Container Management**: Handles 6 containers (users, sessions, conversations, prompts, study_participants, study_metrics)

**Key Methods:**
- `create_user()`, `get_user_by_email()`, `get_user()`
- `create_session()`, `get_session()`, `delete_session()`
- `create_conversation()`, `get_conversation()`, `get_user_conversations()`
- `create_prompt()`, `get_conversation_prompts()`
- `save_study_participant()`, `get_study_participant()`

### 2. AIService (`app/services/ai_service.py`)

**Purpose**: Generates context-aware conversation prompts using Azure OpenAI

**Key Features:**
- **Texting Style Analysis**: Analyzes user's actual texting patterns (emoji usage, punctuation, formality)
- **Context-Aware Prompts**: Uses last 20 messages + relationship health to generate prompts
- **Relationship Health Awareness**: Adjusts prompt type based on status:
  - `wilted` (60+ days) → Reconnection prompts
  - `dormant` (30-60 days) → Gentle check-ins
  - `attention` (14-30 days) → Maintenance prompts
  - `healthy` (<14 days) → Natural continuation
- **Fallback Prompts**: Template-based prompts if API unavailable

**Key Methods:**
- `generate_prompts()` - Main method for generating prompts
- `_analyze_user_texting_style()` - Analyzes user's messaging patterns
- `_call_azure_openai()` - Calls Azure OpenAI API
- `infer_contact_name()` - AI-powered name extraction
- `classify_contact_category()` - AI-powered category detection

### 3. iMessageService (`app/services/imessage_service.py`)

**Purpose**: Integrates with Photon SDK bridge server for real-time iMessage access

**Key Features:**
- **Async HTTP Client**: Uses httpx for async requests to bridge server
- **Message Retrieval**: Gets chats, messages, sends messages
- **Real-Time Listening**: Webhook support for new messages

**Key Methods:**
- `get_chats()` - Get all iMessage chats
- `get_messages()` - Get messages from a chat
- `send_message()` - Send message via iMessage
- `start_listening()` - Start real-time message listening

### 4. ChatParser (`app/services/chat_parser.py`)

**Purpose**: Parses WhatsApp chat exports (legacy feature, now primarily uses iMessage)

**Key Features:**
- Parses .txt or .zip WhatsApp exports
- Handles multiple date formats
- Filters system messages
- Supports group chats (creates individual conversations per person)
- Calculates metrics (reciprocity, response time, days since contact)

---

## 🎨 Frontend Components Explained

### App.tsx - Main Router

**Purpose**: Manages view routing and global state

**View Flow:**
```
Onboarding → Study Enrollment → Grove Dashboard → [Conversation View | Analytics | Schedule | Settings]
```

**Key State:**
- `currentView`: Current view (onboarding, grove, conversation, etc.)
- `user`: Current user data
- `selectedContact`: Currently selected contact
- `studyStatus`: Research study status

### GroveDashboard.tsx - Main Visualization

**Purpose**: Displays all contacts as leaves on branches in a "grove" visualization

**Visual Properties:**
- **Leaf Color**: Relationship health
  - Green: Healthy (<14 days)
  - Orange: Needs Attention (14-30 days)
  - Pink: Dormant (30-60 days, shown as bud)
  - Brown: At Risk/Wilted (60+ days)
- **Branch Thickness**: Interaction frequency (messages per day)
- **Branch Length**: Recency of contact (distance from center)
- **Leaf Size**: Total messages
- **Position**: Radial layout (angle = evenly distributed, distance = recency)

**Layout Algorithm:**
- Center point: (500, 200) - represents "You"
- Each contact positioned using:
  - Angle: Evenly distributed around circle
  - Distance: Based on recency (recent = closer, old = farther)
  - Branch thickness: Based on frequency

### ConversationView.tsx - Conversation Detail

**Purpose**: Shows detailed conversation view with AI prompts

**Features:**
- Displays conversation history (fetched from iMessage via Photon)
- Shows AI-generated prompts
- Allows sending messages (via iMessage integration)
- Tracks prompt usage (sent as-is, edited, dismissed) for research

### Study Components

**StudyEnrollment.tsx**: Handles enrollment in 3-condition research study
**StudyStatusBanner.tsx**: Shows study progress and prompts for surveys
**PostConditionSurvey.tsx**: Post-condition survey after each 3-day period

---

## 🔬 Research Study System

### Overview

The application includes a built-in 3-condition research experiment to study the impact of AI prompts on relationship quality.

### Three Conditions

1. **`no_prompt`**: No AI prompts shown (control)
2. **`generic_prompt`**: Generic prompts (e.g., "Hey! How are you?")
3. **`context_aware`**: Context-aware prompts generated by AI

### Study Flow

```
1. User enrolls → Assigned counterbalanced condition order (e.g., [no_prompt, generic_prompt, context_aware])
   ↓
2. Study runs for 9 days (3 days per condition)
   ↓
3. Each condition:
   - User uses app normally
   - System tracks metrics (messages sent, prompts shown, edits, etc.)
   ↓
4. After each 3-day condition:
   - User completes post-condition survey
   - System advances to next condition
   ↓
5. After all 3 conditions:
   - Study complete
   - Data exported for analysis
```

### Metrics Tracked

- Messages sent
- Prompts shown/accepted/edited/dismissed
- Edit rate (prompts_edited / prompts_sent)
- Average message length
- Response times
- Survey responses (perceived connectedness, authenticity, enjoyment, etc.)

---

## 🔐 Authentication Flow

### Registration

1. User provides: name, email, password
2. Backend hashes password (SHA-256)
3. Creates user in Cosmos DB
4. Creates session with token
5. Returns token to frontend
6. Frontend stores token in localStorage

### Login

1. User provides: email, password
2. Backend hashes password and compares
3. Creates/updates session
4. Returns token
5. Frontend stores token

### Token Validation

- Token stored in localStorage
- Sent in `Authorization: Bearer <token>` header
- Backend validates via `/api/auth/me` endpoint
- Session stored in Cosmos DB with expiration

### iMessage Auto-Login

- User connects iMessage
- Backend gets iMessage account from Photon
- Auto-creates or finds user based on iMessage account
- No password required (identified by iMessage account)

---

## 📱 iMessage Integration Architecture

### Components

1. **Photon SDK** (`photon-imessage-kit/`): Direct access to macOS iMessage database
2. **Bridge Server** (`photon-server/server.js`): Node.js server that exposes HTTP API
3. **Python Backend** (`backend/app/routes/imessage.py`): Flask routes for iMessage operations
4. **iMessageService** (`backend/app/services/imessage_service.py`): Service layer for Photon communication

### Flow

```
macOS iMessage Database
    ↓
Photon SDK (reads directly from database)
    ↓
Bridge Server (Node.js, localhost:4000)
    ├─→ HTTP API endpoints
    └─→ Real-time events (Socket.IO)
    ↓
Python Backend (Flask, localhost:5002)
    ├─→ /api/imessage/connect
    ├─→ /api/imessage/sync
    ├─→ /api/imessage/send
    └─→ /api/imessage/webhook (for real-time)
    ↓
Frontend (React)
```

### Key Endpoints

- `POST /api/imessage/connect` - Connect and auto-login
- `POST /api/imessage/sync` - Sync all conversations
- `GET /api/imessage/chats` - Get available chats
- `POST /api/imessage/send` - Send message
- `POST /api/imessage/webhook` - Receive real-time message events

---

## 🎯 Relationship Health Calculation

### Status Determination

```python
def get_relationship_health(conversation):
    days_since = conversation.metrics.days_since_contact
    
    if days_since > 60:
        return "wilted"      # Brown leaf, at risk
    elif days_since > 30:
        return "dormant"     # Pink bud, needs attention
    elif days_since > 14:
        return "attention"   # Orange leaf, getting stale
    else:
        return "healthy"    # Green leaf, active
```

### Metrics Calculated

- **Reciprocity**: Balance of messages (0-1, where 0.5 = balanced)
- **Average Response Time**: Hours between messages
- **Days Since Contact**: Days since last message
- **Interaction Frequency**: Messages per day (past 50 days)
- **Common Topics**: Extracted keywords from messages

---

## 🔒 Privacy & Security

### Privacy Features

1. **Message Content Not Stored**: Only metadata (count, timestamps) stored in cloud
2. **Local Processing**: Messages processed locally, only metadata synced
3. **User Control**: One-click data purge available
4. **No Message Sending**: AI suggests but never sends automatically

### Security Features

1. **Password Hashing**: SHA-256 (consider upgrading to bcrypt)
2. **Token-Based Auth**: Sessions stored in Cosmos DB
3. **CORS Protection**: Configured for specific origins
4. **Input Validation**: Basic validation on routes

---

## 🚀 Deployment

### Backend (Azure App Service)

- Deployed via GitHub Actions (`azure-deploy.yml`)
- Uses Azure App Service for hosting
- Environment variables from Azure Key Vault
- Cosmos DB connection configured

### Frontend

- Static files (can be deployed to Azure Static Web Apps or similar)
- Connects to backend API via `VITE_API_URL` environment variable

---

## 📝 Key Design Patterns

1. **Application Factory Pattern**: Flask app created via `create_app()` function
2. **Singleton Pattern**: `AzureStorageService` ensures single DB connection
3. **Service Layer Pattern**: Business logic separated from routes
4. **Data Model Pattern**: Dataclasses with `to_dict()` / `from_dict()` for serialization
5. **Fallback Pattern**: Graceful degradation (mock mode, template prompts)

---

## 🔮 Future Enhancements (From Code Comments)

1. **Sentiment Analysis**: Analyze message sentiment
2. **Response Timing**: Suggest optimal times to reach out
3. **Topic Extraction**: Better NLP for topic identification
4. **Calendar Integration**: Schedule prompts in calendar
5. **Multi-platform Sync**: Real-time WhatsApp/Telegram integration
6. **Growth Rings**: Visualize relationship history over time

---

## 🎓 Summary

**Sorry I Missed This** is a comprehensive relationship management system that:

1. **Visualizes relationships** as a living grove with health indicators
2. **Generates AI-powered prompts** that match your texting style and conversation context
3. **Integrates with iMessage** for real-time message access and sending
4. **Tracks relationship health** through metrics and analytics
5. **Conducts research** on the impact of AI prompts on relationship quality

The architecture is well-structured with clear separation between frontend and backend, and the data flow is logical and straightforward. The system prioritizes privacy by not storing message content in the cloud, while still providing powerful AI features through local processing and metadata analysis.

