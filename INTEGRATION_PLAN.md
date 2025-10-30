# Frontend-Backend Integration Plan

## Current State Analysis

### Backend API Endpoints Available
✅ **Authentication:**
- POST `/api/auth/register` - Working with Azure Cosmos DB
- POST `/api/auth/login` - Working with Azure Cosmos DB
- POST `/api/auth/logout` - Working
- GET `/api/auth/me` - Working

✅ **Recommendations:**
- GET `/api/recommendations` - Needs user_id, returns conversation prompts
- POST `/api/recommendations/<prompt_id>/use` - Mark prompt as used
- GET `/api/stats/<user_id>` - Get user statistics

⚠️ **Missing/Need Implementation:**
- Contact CRUD endpoints
- Conversation endpoints
- AI analysis endpoints
- Analytics endpoints
- Schedule endpoints

### Frontend Current State
- ✅ Beautiful UI with tree/grove visualization
- ✅ API client structure ready
- ✅ TypeScript interfaces defined
- ⚠️ Using mock/static data everywhere
- ⚠️ No loading states
- ⚠️ No error handling
- ⚠️ Authentication partially implemented

## Integration Tasks

### Phase 1: Core Authentication & User Flow (Priority 1)
1. **Fix API base URL** - Currently hardcoded to port 3000, should be 5002
2. **Complete authentication flow** - Connect onboarding to working backend
3. **Add loading states** - Show spinners during API calls
4. **Add error handling** - Display user-friendly error messages
5. **Session persistence** - Keep user logged in across page reloads

### Phase 2: Contact Management (Priority 2)
6. **Implement contact endpoints** in backend
7. **Connect GroveDashboard** to real contact data
8. **Add contact CRUD operations**
9. **Sync contact positions** back to backend

### Phase 3: Conversations & AI (Priority 3)
10. **Implement conversation endpoints** in backend
11. **Connect ConversationView** to real data
12. **Implement AI prompt generation** endpoints
13. **Add conversation analysis**

### Phase 4: Analytics & Schedule (Priority 4)
14. **Implement analytics endpoints**
15. **Connect Analytics view**
16. **Implement schedule endpoints**
17. **Connect Schedule view**

### Phase 5: Polish & Responsive Design (Priority 5)
18. **Make fully responsive** (mobile, tablet, desktop)
19. **Add transitions and animations**
20. **Optimize performance**
21. **Add accessibility features**

## Implementation Order

1. Fix API URL (5 min)
2. Add loading & error states to components (30 min)
3. Connect authentication (15 min)
4. Implement backend contact endpoints (2 hours)
5. Connect GroveDashboard to real contacts (1 hour)
6. Implement conversation endpoints (2 hours)
7. Connect ConversationView (1 hour)
8. Make responsive (2 hours)
9. Polish and test (1 hour)

Total: ~10-12 hours of work

## API Endpoint Gaps to Fill

### Need to Implement:
```
POST /api/contacts - Create contact
GET /api/contacts - List contacts with filters
GET /api/contacts/{id} - Get single contact
PUT /api/contacts/{id} - Update contact
DELETE /api/contacts/{id} - Delete contact

GET /api/conversations - List conversations
GET /api/conversations/{id} - Get conversation
GET /api/conversations/{id}/summary - AI summary

POST /api/ai/generate-prompts - Generate AI prompts
POST /api/ai/analyze-relationship - Analyze relationship

GET /api/analytics/overview - Analytics dashboard
GET /api/schedule/prompts - Scheduled prompts
GET /api/schedule/catch-up - Catch-up suggestions
```
