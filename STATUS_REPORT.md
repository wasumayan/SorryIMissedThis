# SIMT Codebase Status Report

**Date:** Current  
**Purpose:** Handoff documentation for teammates  
**Status:** Partially functional, multiple known issues

---

## Architecture Overview

### Components

1. **Frontend (React TypeScript)**
   - Location: `FigmaFrontEnd/`
   - Port: 3000
   - Framework: React + Vite
   - Main components: Onboarding, GroveDashboard, ConversationView, Settings

2. **Backend (Python Flask)**
   - Location: `backend/`
   - Port: 5002
   - Database: Azure Cosmos DB (optional - has "mock mode" fallback)
   - Main services: iMessage integration, AI prompt generation, conversation metrics

3. **Photon Bridge Server (Node.js)**
   - Location: `photon-server/`
   - Port: 4000
   - Purpose: Bridges Python backend to Photon iMessage SDK
   - SDK: `@photon-ai/imessage-kit` (direct local database access)

### Data Flow

```
iMessage (macOS) 
  → Photon SDK (Node.js bridge server)
  → Python Flask backend
  → Azure Cosmos DB (metadata only, no message content)
  → React frontend
```

**Privacy Note:** Message content is NEVER stored in Cosmos DB. Only metadata (counts, timestamps, metrics) is stored. Messages are fetched fresh from iMessage when needed for AI analysis.

---

## What's Working

### 1. iMessage SDK Integration
- Photon SDK (`@photon-ai/imessage-kit`) is successfully installed and can access local iMessage database
- Bridge server can list chats and fetch messages
- Messages are being retrieved from iMessage

### 2. Backend Services
- Flask server runs and accepts requests
- Azure Cosmos DB integration works (when configured)
- Mock mode works when Cosmos DB credentials are missing
- AI service is configured (Azure OpenAI or regular OpenAI)

### 3. Frontend Basic Structure
- React app compiles and runs
- Onboarding flow exists (though has issues - see below)
- Grove dashboard renders (though visualization is broken)
- Basic routing works

### 4. AI Prompt Generation (Code Structure)
- AI service code follows the documented architecture
- Uses GPT-4o-mini (or fallback)
- Analyzes user texting style
- Generates context-aware prompts (when it works)

---

## What's Broken / Not Working

### 1. Graph Visualization (Frontend)
**Status:** Broken - contacts not displaying correctly

**Issues:**
- Contacts appear clustered/overlapping instead of evenly distributed radially
- ViewBox calculations may be incorrect
- Contact coordinates may be off-screen
- Line thickness and length not reflecting frequency/recency correctly
- Zoom/pan functionality may be interfering with rendering

**Location:** `FigmaFrontEnd/src/components/GroveDashboard.tsx`
- `layoutContacts()` function calculates positions
- SVG viewBox: `${0 - panX} ${0 - panY} ${1000 / zoomLevel} ${700 / zoomLevel}`
- Center is at (500, 350)
- Contacts should be evenly distributed at 360° / total contacts

### 2. Context-Aware Prompts Not Working
**Status:** Prompts are generic, not context-aware

**Issues:**
- Daily suggestions show generic prompts like "Initiate a conversation with {name}"
- Prompts don't reference actual conversation history
- AI-generated prompts may not be generating correctly
- User texting style analysis may not be working

**Location:**
- `backend/app/routes/ai.py` - `get_daily_suggestions()` endpoint
- `backend/app/routes/conversations.py` - `generate_new_prompts()` endpoint
- `backend/app/services/ai_service.py` - Core AI logic

**What Should Happen:**
- Fetch last 100 messages from iMessage when generating prompts
- Analyze conversation context
- Generate personalized prompts based on actual message history
- Match user's texting style

**What's Actually Happening:**
- Daily suggestions use simple fallback prompts
- Context-aware generation may be failing silently
- Messages may not be fetched correctly from iMessage service

### 3. Contact Names Not Showing
**Status:** Phone numbers/emails shown instead of contact names

**Issues:**
- Contact names from iMessage are often null
- AppleScript contact lookup in bridge server is unreliable
- AI name inference may be failing (401 errors seen in logs)
- Fallback to phone numbers/emails

**Location:**
- `photon-server/server.js` - `lookupContactName()` function
- `backend/app/services/name_inference.py` - AI name inference
- `backend/app/routes/contacts.py` - Contact formatting

### 4. Message Sending Not Working
**Status:** Cannot send messages via iMessage

**Issues:**
- Frontend "Send via iMessage" button may be disabled
- `conversationId` may not map correctly to `chatId`
- Backend may not be finding the correct chatId for conversations
- Photon SDK send endpoint may not be working

**Location:**
- `FigmaFrontEnd/src/components/ConversationView.tsx` - Send button
- `backend/app/routes/imessage.py` - `/send` endpoint
- `photon-server/server.js` - `/api/messages/send` endpoint

### 5. Frontend Interactivity Issues
**Status:** Click interactions not working

**Issues:**
- Clicking on contacts/leaves doesn't open modals
- Prompts in sidebar not clickable
- Relationship stats modal not appearing
- `AnimatePresence` may not be working correctly

**Location:**
- `FigmaFrontEnd/src/components/GroveDashboard.tsx` - Click handlers
- `FigmaFrontEnd/src/components/RelationshipStatsModal.tsx` - Modal rendering

### 6. Onboarding Flow Issues
**Status:** Auto-login bypasses onboarding

**Issues:**
- Hardcoded flag `FORCE_ONBOARDING_FOR_TESTING` may be enabled
- Token validation may be too lenient
- User name validation may not be working
- Onboarding steps may not complete correctly

**Location:**
- `FigmaFrontEnd/src/App.tsx` - Auth check logic
- `FigmaFrontEnd/src/components/Onboarding.tsx` - Onboarding steps

---

## Recurring Issues

### 1. Sync Returns 0 Conversations
**Frequency:** Common

**Symptoms:**
- User syncs iMessage
- Backend reports "Successfully synced 0 conversations"
- No contacts appear in frontend

**Possible Causes:**
- Chat filtering too strict (filtering out valid chats)
- `chatId` format mismatches between SDK and backend
- Messages not being found for chats
- Contact name logic rejecting chats without names

**Location:**
- `backend/app/services/imessage_service.py` - `sync_conversations()`
- `backend/app/routes/imessage.py` - `/sync` endpoint
- Chat filtering logic in both files

### 2. Event Loop Errors
**Frequency:** Occasional

**Symptoms:**
- `Event loop is closed` errors in backend logs
- Async operations failing
- Flask routes with async code

**Location:**
- `backend/app/routes/imessage.py` - Multiple endpoints
- `backend/app/services/imessage_service.py` - Service methods

**Current Workaround:**
- Creating new event loops for each async operation
- Using `loop.run_until_complete()` in Flask routes

### 3. Port Conflicts
**Frequency:** Occasional

**Symptoms:**
- `EADDRINUSE` errors
- Services can't start

**Ports:**
- Frontend: 3000
- Photon server: 4000
- Backend: 5002

**Current Solution:**
- `quickstart.sh` includes `pkill` commands
- May need manual cleanup if processes hang

### 4. Datetime Serialization Errors
**Frequency:** Occasional

**Symptoms:**
- `TypeError: Object of type datetime is not JSON serializable`
- Cosmos DB save failures

**Location:**
- `backend/app/services/azure_storage.py` - `create_conversation()`
- `backend/app/models/__init__.py` - `ConversationMetrics.to_dict()`

**Current Fix:**
- `serialize_datetimes()` function exists but may not cover all cases

### 5. OpenAI API Errors
**Frequency:** Occasional

**Symptoms:**
- `Error code: 401` - Authentication failures
- AI prompts not generating

**Possible Causes:**
- API key not set correctly
- Azure OpenAI vs regular OpenAI configuration mismatch
- Endpoint/deployment name incorrect

**Location:**
- `backend/app/utils/azure_openai.py` - Client initialization
- `backend/app/services/ai_service.py` - AI calls

---

## Current State by Component

### Photon Bridge Server (`photon-server/server.js`)
**Status:** Functional but unreliable

**Working:**
- Connects to Photon SDK
- Lists chats
- Fetches messages
- Contact name lookup (AppleScript) - unreliable

**Issues:**
- Contact names often null
- Message fetching may return 0 for some chatId formats
- Send message endpoint untested

### Backend iMessage Service (`backend/app/services/imessage_service.py`)
**Status:** Partially functional

**Working:**
- Connects to bridge server
- Fetches chats and messages
- Calculates metrics (using ChatParser - see note below)
- Syncs conversations to Cosmos DB

**Issues:**
- Chat filtering may be too strict
- Message fetching may fail for some chatId formats
- Metrics calculation uses ChatParser (originally for WhatsApp) - works but not ideal

**Note on ChatParser:**
- `ChatParser` was built for WhatsApp parsing
- Currently only used for `_calculate_metrics()` method (platform-agnostic)
- The WhatsApp-specific parsing code is not used for iMessage
- This is fine but could be cleaner

### Backend AI Service (`backend/app/services/ai_service.py`)
**Status:** Code structure correct, execution may fail

**Working:**
- Follows documented architecture
- Analyzes user texting style
- Prepares context from messages
- Calls Azure OpenAI correctly

**Issues:**
- May not be receiving messages correctly
- Prompts may not be generating
- User preferences may not be read correctly
- Fallback prompts are generic

### Backend Routes (`backend/app/routes/`)
**Status:** Mixed

**Working:**
- `/imessage/connect` - User identification
- `/imessage/sync` - Syncs conversations (but may return 0)
- `/contacts` - Returns contact list
- `/conversations/<id>/prompts` - Endpoint exists

**Issues:**
- `/imessage/send` - May not find chatId correctly
- `/ai/daily-suggestions` - Returns generic prompts
- `/conversations/<id>/prompts` - May not fetch messages correctly

### Frontend (`FigmaFrontEnd/`)
**Status:** UI renders but functionality broken

**Working:**
- App compiles and runs
- Basic routing
- API client makes requests
- Components render

**Issues:**
- Graph visualization broken
- Click interactions not working
- Modals not appearing
- Prompts not context-aware
- Onboarding may auto-skip

### Azure Cosmos DB (`backend/app/services/azure_storage.py`)
**Status:** Functional when configured

**Working:**
- Saves conversations (metadata only)
- Retrieves conversations
- Handles scheduled prompts
- Mock mode works when not configured

**Issues:**
- Datetime serialization may fail in edge cases
- Duplicate conversation creation (409 errors) - has fix but may recur
- Partition key handling

---

## Known Configuration Issues

### Environment Variables
**Backend `.env`:**
- `OPENAI_API_KEY` or `AZURE_OPENAI_API_KEY` - Required for AI
- `PHOTON_SERVER_URL=http://localhost:4000` - Bridge server URL
- Cosmos DB credentials (optional - uses mock mode if missing)

**Photon Server `.env`:**
- `PORT=4000` - Server port

**Frontend:**
- `VITE_API_URL=http://localhost:5002/api` - Backend API URL

### Port Configuration
- Frontend: 3000 (hardcoded in `vite.config.ts`)
- Photon server: 4000
- Backend: 5002

---

## Data Models

### Conversation Storage
**What's Stored:**
- Conversation metadata (partner name, category, status)
- Metrics (reciprocity, response time, days since contact)
- Message count (not content)
- Attachment counts (images, voice messages)
- `chatId` for iMessage operations

**What's NOT Stored:**
- Message content (privacy requirement)
- Message text
- Attachments

**When Messages Are Used:**
- Fetched fresh from iMessage when generating AI prompts
- Used locally for metrics calculation
- Never persisted to cloud

---

## Testing Status

### What Has Been Tested
- Photon SDK basic functionality (in test folder)
- Bridge server can list chats
- Backend can receive data from bridge server
- Cosmos DB saves conversations

### What Has NOT Been Tested
- End-to-end message sending
- Context-aware prompt generation with real data
- Graph visualization with multiple contacts
- Frontend click interactions
- Real-time message watching
- Contact name resolution reliability

---

## Critical Path to Functionality

### For Graph Visualization to Work:
1. Fix `layoutContacts()` to properly distribute contacts radially
2. Fix SVG viewBox to show contacts correctly
3. Ensure contact coordinates are within visible area
4. Fix line thickness/length calculations

### For Context-Aware Prompts to Work:
1. Ensure messages are fetched from iMessage when generating prompts
2. Verify AI service receives messages correctly
3. Check that user preferences are read correctly
4. Verify Azure OpenAI API calls succeed
5. Ensure prompts are saved and retrieved correctly

### For Message Sending to Work:
1. Verify `conversationId` → `chatId` mapping works
2. Test Photon SDK send endpoint
3. Ensure frontend passes correct data
4. Verify backend finds chatId from conversation

### For Frontend Interactivity:
1. Fix click handlers on contacts/leaves
2. Ensure modals render correctly
3. Fix `AnimatePresence` if needed
4. Verify state management for selected contacts

---

## Code Quality Notes

### Technical Debt
- ChatParser originally for WhatsApp, now only used for metrics (works but not ideal)
- Multiple event loop management patterns (could be standardized)
- Mixed async/sync patterns in Flask routes
- Hardcoded test flags in frontend
- Inconsistent error handling

### Architecture Decisions
- Privacy-first: Messages never stored in cloud
- Mock mode: App works without Cosmos DB (development)
- Bridge server: Necessary because Photon SDK is Node.js, backend is Python
- Direct database access: Using simpler Photon SDK (not Advanced SDK with server)

---

## Logs and Debugging

### Log Locations
- Backend: `/tmp/backend.log`
- Photon server: `/tmp/photon-server.log`
- Frontend: Browser console + `/tmp/frontend.log`

### Debug Logging
- Extensive debug logging added throughout
- Request IDs for tracing
- Timing information
- State dumps in frontend

### Common Error Patterns
- `0 conversations synced` - Check chat filtering logic
- `Event loop is closed` - Async/event loop issues
- `401 errors` - OpenAI API configuration
- `TypeError: datetime` - Serialization issues
- `EADDRINUSE` - Port conflicts

---

## Dependencies

### Backend
- Flask
- Azure Cosmos DB SDK
- OpenAI SDK (supports both Azure and regular)
- httpx (for async HTTP to bridge server)

### Photon Server
- `@photon-ai/imessage-kit` - Photon SDK
- `better-sqlite3` - For Node.js SQLite access
- Express.js

### Frontend
- React + TypeScript
- Vite
- Motion (for animations)
- Various UI components

---

## Next Steps for Teammates

1. **Start with graph visualization** - Most visible issue
2. **Test prompt generation end-to-end** - Verify messages are fetched and AI is called
3. **Fix contact name resolution** - Either fix AppleScript or improve AI inference
4. **Test message sending** - Verify full flow works
5. **Fix frontend interactivity** - Click handlers and modals
6. **Remove hardcoded test flags** - Clean up onboarding flow

---

## Important Files to Review

### Core Integration
- `photon-server/server.js` - Bridge server
- `backend/app/services/imessage_service.py` - iMessage service
- `backend/app/routes/imessage.py` - iMessage routes

### AI/Prompts
- `backend/app/services/ai_service.py` - AI service
- `backend/app/routes/conversations.py` - Prompt generation
- `backend/app/routes/ai.py` - Daily suggestions

### Frontend
- `FigmaFrontEnd/src/components/GroveDashboard.tsx` - Main dashboard
- `FigmaFrontEnd/src/components/ConversationView.tsx` - Conversation view
- `FigmaFrontEnd/src/components/Onboarding.tsx` - Onboarding

### Data Storage
- `backend/app/services/azure_storage.py` - Cosmos DB operations
- `backend/app/models/__init__.py` - Data models

---

## Documentation Files

- `AI_PROMPT_GENERATION.md` - AI prompt architecture (code follows this)
- `PRIVACY_ARCHITECTURE.md` - Privacy requirements
- `REALTIME_INTEGRATION.md` - Real-time message watching
- `QUICKSTART.md` - Setup instructions

---

**End of Status Report**

