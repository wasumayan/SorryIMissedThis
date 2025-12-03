# AI-Powered Message Prompt Generation

## Overview

SIMT uses **Azure OpenAI** (GPT-4o-mini) to generate context-aware conversation prompts that help users maintain relationships. The system analyzes conversation history and generates personalized message suggestions based on:

1. **Conversation Context** - Recent messages and topics
2. **User Tone Preference** - Formal, friendly, or playful
3. **Relationship Health** - Healthy, attention, dormant, or at risk
4. **Conversation Metrics** - Reciprocity, response time, days since contact

## How It Works

### 1. Context Preparation (`_prepare_context`)

The AI service gathers context from the conversation:

```python
# Last 20 messages (chronological order)
recent_messages = conversation.get_last_n_messages(20)

# Relationship metadata
- Partner name
- Days since last contact
- Total messages
- Reciprocity score (0-1)
- Common topics (extracted keywords)
```

**Example Context:**
```
Conversation with: Jane
Days since last contact: 9
Total messages: 45
Reciprocity: 0.75

Recent conversation:
Bob: Hey Jane, did you decide which COS classes you're taking next semester?
Jane: Still deciding! I'm leaning toward COS 324 if I can handle the workload.
Bob: You should! I loved the projects last year—lots of hands-on ML.
Jane: That's super helpful, thanks. Did you also take COS 326?
Bob: Not yet, but I'm planning on it after COS 324. Want to pair up for the first assignment?
```

### 2. User Tone Preference

The system retrieves the user's preferred tone from their settings:

```python
user.preferences.ai.promptStyle  # 'formal', 'friendly', or 'playful'
```

**Tone Examples:**
- **Formal**: "I hope this message finds you well. I wanted to follow up regarding..."
- **Friendly**: "Hey! How's everything going? I was thinking about you..."
- **Playful**: "Yo! What's up? 😄 Remember that thing we talked about?"

### 3. Relationship Health Analysis

The system determines relationship health and adjusts prompt focus:

| Health Status | Days Since Contact | Prompt Focus |
|--------------|-------------------|--------------|
| **Healthy** | 0-14 days | Continue conversation naturally |
| **Attention** | 14-30 days | Maintain connection, show interest |
| **Dormant** | 30-60 days | Gentle check-in, re-engagement |
| **At Risk** | 60+ days | Reconnection, show genuine care |

### 4. AI Prompt Generation

The system sends a carefully crafted prompt to Azure OpenAI:

**System Message:**
```
You are a helpful assistant that generates natural, context-aware conversation prompts 
to help people stay connected with their friends and family. 

Your prompts should:
1. Be based on the actual conversation history and the user's texting style
2. Feel authentic and personal (not generic)
3. Match a {tone} tone
4. Focus on {prompt_focus}
5. Reference specific topics or events mentioned
6. Be short (1-2 sentences)

Return {num_prompts} different prompts as a JSON array...
```

**User Message:**
```
Based on this conversation with {partner_name}, generate {num_prompts} conversation prompts:

{context}

Generate prompts that would help naturally continue or restart this conversation.
```

### 5. Response Processing

The AI returns JSON with prompts:
```json
[
  {
    "text": "Hey Jane! Did you end up registering for COS 324 yet?",
    "type": "follow_up",
    "context": "Checking on Jane's course selection",
    "confidence": 0.83
  },
  {
    "text": "I just grabbed a spot in COS 324—want to sync our schedules?",
    "type": "check_in",
    "context": "Coordinating class schedules",
    "confidence": 0.79
  }
]
```

## API Flow

### Endpoint: `GET /api/recommendations`

1. **Retrieve User Settings**
   ```python
   user = storage.get_user_by_id(user_id)
   user_tone = user.preferences.ai.promptStyle  # 'friendly'
   ```

2. **Get Conversations**
   ```python
   conversations = storage.get_user_conversations(user_id)
   ```

3. **For Each Conversation:**
   - Check for existing unused prompts
   - If none, generate new prompts with:
     - Conversation context (last 20 messages)
     - User tone preference
     - Relationship health status
   - Save prompts to database

4. **Return Recommendations**
   ```json
   {
     "conversations": [
       {
         "partner_name": "Jane",
         "relationship_health": "attention",
         "prompts": [
           {
             "text": "Hey Jane! Did you end up registering for COS 324 yet?",
             "type": "follow_up",
             "context": "Checking on Jane's course selection",
             "confidence": 0.83
           }
         ]
       }
     ]
   }
   ```

## Context Sources

### From Conversation History
- **Last 20 messages** - Recent conversation flow
- **Common topics** - Extracted keywords (e.g., "COS 324", "Schedules")
- **Message patterns** - Who initiates, response times

### From Metrics
- **Days since contact** - Urgency indicator
- **Reciprocity** - Conversation balance (0-1)
- **Total messages** - Relationship depth indicator

### From User Settings
- **Tone preference** - Formal/friendly/playful
- **Auto-analysis** - Whether to analyze automatically

## Prompt Types

The AI generates three types of prompts:

1. **follow_up** - Reference specific topics/events from conversation
   - Example: "Hey! How did that job interview go?"

2. **check_in** - General check-in messages
   - Example: "Just wanted to see how you're doing!"

3. **reconnect** - Re-engagement after long absence
   - Example: "It's been a while! Would love to catch up soon."

## Tone Adaptation

The AI adapts language based on tone preference:

### Friendly (Default)
```
"Hey Jane! How's everything going? I was thinking about you..."
```

### Formal
```
"Hello Jane, I hope this message finds you well. I wanted to follow up regarding..."
```

### Playful
```
"Yo Jane! 😄 What's up? Remember that thing we talked about?"
```

## Relationship Health Adaptation

### Healthy (0-14 days)
- Focus: Natural continuation
- Style: Casual, ongoing conversation
- Example: "How did that project turn out?"

### Attention (14-30 days)
- Focus: Maintain connection
- Style: Show interest, check in
- Example: "Hey! Been thinking about you. How have you been?"

### Dormant (30-60 days)
- Focus: Gentle re-engagement
- Style: Warm, non-pressuring
- Example: "Hi! It's been a while. Would love to catch up when you have time."

### At Risk (60+ days)
- Focus: Reconnection, show care
- Style: Genuine, caring
- Example: "Hey, I've been thinking about you. I hope everything's okay. Would love to reconnect."

## Configuration

### Azure OpenAI Settings
```env
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_ENDPOINT=https://...
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.7
```

### User Preferences
Stored in user record:
```json
{
  "preferences": {
    "ai": {
      "promptStyle": "friendly",  // formal | friendly | playful
      "autoAnalysis": true
    }
  }
}
```

## Fallback Behavior

If Azure OpenAI is unavailable:
- Uses template-based prompts
- Lower confidence scores (0.6 vs 0.8)
- Still references conversation topics if available
- Maintains basic functionality

## Example: Complete Flow

1. **User opens conversation with Jane**
   - Last contact: 9 days ago
   - Recent topic: "COS 324 course registration"
   - User tone: "friendly"
   - Health: "attention"

2. **System generates context:**
   ```
   Conversation with: Jane
   Days since last contact: 9
   Common topics: COS 324, Schedules, Projects
   Recent messages: [last 20 messages about course selection]
   ```

3. **AI receives prompt:**
   - System: "Generate friendly prompts focused on maintaining connection..."
   - User: "Based on conversation with Jane about COS 324..."

4. **AI returns:**
   ```json
   [
     {
       "text": "Hey Jane! Did you end up registering for COS 324 yet?",
       "type": "follow_up",
       "context": "Checking on Jane's course selection",
       "confidence": 0.83
     }
   ]
   ```

5. **Frontend displays prompt** in ConversationView component

## Real-Time Updates

With iMessage integration:
- New messages trigger context updates
- Prompts can be regenerated with fresh context
- Relationship health recalculated automatically
- Tone preferences can be changed in settings

## Future Enhancements

- **Sentiment Analysis** - Adjust tone based on conversation sentiment
- **Timing Suggestions** - Recommend best time to send based on response patterns
- **Multi-language Support** - Generate prompts in user's preferred language
- **Personality Matching** - Adapt to contact's communication style
- **Context Window Expansion** - Use more message history for deeper context

