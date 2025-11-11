# Conversation-Specific Tone System

## Overview

Each conversation now has its own tone preference, allowing different communication styles for different contacts. For example:
- **Work contacts** → Formal tone
- **Family** → Friendly tone  
- **Friends** → Friendly or playful tone

## How It Works

### 1. Tone Determination

The system determines tone in this priority order:

1. **Explicit tone setting** - If a conversation has `tone` set, use that
2. **Category-based default** - If no explicit tone, use category defaults:
   - `work` → `formal`
   - `family` → `friendly`
   - `friends` → `friendly`

### 2. Conversation Model

Added `tone` field to `Conversation` model:

```python
@dataclass
class Conversation:
    ...
    category: str = "friends"
    tone: Optional[str] = None  # formal, friendly, playful
    
    def get_tone(self) -> str:
        """Get tone with smart defaults"""
        if self.tone:
            return self.tone
        # Category-based defaults
        category_tone_map = {
            'work': 'formal',
            'family': 'friendly',
            'friends': 'friendly'
        }
        return category_tone_map.get(self.category, 'friendly')
```

### 3. AI Prompt Generation

When generating prompts, the system:

1. Gets conversation-specific tone (via `get_tone()`)
2. Passes it to Azure OpenAI in the system prompt:
   ```
   Your prompts should:
   ...
   3. Match a {conversation_tone} tone
   ...
   ```
3. AI generates prompts matching that specific tone

### 4. Examples

**Work Contact (Formal):**
```
"Hello John, I wanted to follow up regarding the project we discussed. 
How is everything progressing on your end?"
```

**Friend (Friendly):**
```
"Hey Sarah! How's everything going? I was thinking about you..."
```

**Close Friend (Playful):**
```
"Yo! 😄 What's up? Remember that thing we talked about?"
```

## API Endpoints

### Update Conversation Tone

```
PUT /api/conversations/{conversation_id}/tone?user_id={user_id}

Body:
{
  "tone": "formal" | "friendly" | "playful"
}
```

### Get Recommendations (Uses Conversation Tone)

```
GET /api/recommendations?user_id={user_id}

Returns prompts generated with each conversation's specific tone
```

## Frontend Integration

### Update Tone

```typescript
// Update tone for a specific conversation
await apiClient.updateConversationTone(conversationId, 'playful');
```

### Contact Object

Contacts now include `tone` field:

```typescript
interface Contact {
  ...
  tone?: 'formal' | 'friendly' | 'playful';
  ...
}
```

## Default Behavior

### New Conversations

When a conversation is created:
- If category is `work` → tone defaults to `formal`
- If category is `family` or `friends` → tone defaults to `friendly`
- User can override by setting explicit tone

### Category Changes

If you change a conversation's category:
- Tone doesn't automatically change
- Existing explicit tone is preserved
- If no explicit tone was set, new category default applies

## Use Cases

### Scenario 1: Work Contact
- Category: `work`
- Default tone: `formal`
- Prompts: "Hello [Name], I wanted to follow up regarding..."

### Scenario 2: Family Member
- Category: `family`
- Default tone: `friendly`
- Prompts: "Hey Mom! How are you doing?..."

### Scenario 3: Close Friend (Custom)
- Category: `friends`
- Explicit tone: `playful`
- Prompts: "Yo! 😄 What's up?..."

## Implementation Details

### Data Storage

Tone is stored in Cosmos DB as part of conversation document:

```json
{
  "id": "conversation-id",
  "category": "work",
  "tone": "formal",  // Optional, defaults based on category
  ...
}
```

### Backward Compatibility

- Existing conversations without `tone` field use category-based defaults
- No migration needed
- System gracefully handles missing tone field

## Future Enhancements

1. **AI Tone Detection** - Analyze conversation history to suggest appropriate tone
2. **Tone Learning** - Learn preferred tone from user's actual messages
3. **Per-Contact Override** - Allow tone override per contact (not just category)
4. **Tone Mixing** - Support mixed tones (e.g., "friendly but professional")

