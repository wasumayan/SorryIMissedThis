# Prompt Usage Analytics

## Overview

The app tracks how users interact with AI-generated prompts to measure engagement and improve prompt quality.

## What We Track

### Prompt Usage Events
When a user sends a message using an AI-generated prompt, we track:

- **User ID**: Who sent it
- **Conversation ID**: Which conversation
- **Prompt ID**: Which AI prompt was used
- **Original Prompt Text**: The AI-generated text
- **Sent Message Text**: What was actually sent
- **Was Edited**: Whether user modified the prompt
- **Edit Similarity**: How similar the sent message is to original (0-1)
- **Timestamp**: When it was sent

## Analytics Endpoints

### Get Prompt Usage Stats

**Endpoint:** `GET /api/analytics/prompt-usage`

**Query Parameters:**
- `userId` (optional): Filter by specific user. If omitted, returns global stats.

**Response:**
```json
{
  "success": true,
  "data": {
    "prompt_usage": {
      "total_sent": 150,
      "total_edited": 45,
      "total_original": 105,
      "edit_rate": 0.3
    }
  }
}
```

**Metrics:**
- `total_sent`: Total number of prompts sent
- `total_edited`: Number of prompts that were edited before sending
- `total_original`: Number of prompts sent as-is
- `edit_rate`: Percentage of prompts that were edited (0-1)

## Usage in Frontend

### Sending a Message

When sending a message via `sendiMessage()`, include:

```typescript
await apiClient.sendiMessage(
  conversationId,
  messageText,
  userId,
  promptId,           // ID of the AI prompt
  originalPromptText, // Original AI-generated text
  wasEdited          // true if user edited it
);
```

### Example

```typescript
const originalPrompt = prompts[selectedPrompt];
const messageToSend = customPrompt || originalPrompt.text;
const wasEdited = customPrompt.trim() !== originalPrompt.text.trim();

await apiClient.sendiMessage(
  conversationId,
  messageToSend,
  userId,
  originalPrompt.id,
  originalPrompt.text,
  wasEdited
);
```

## Edit Detection

The frontend automatically detects if a prompt was edited by comparing:
- `customPrompt` (what user typed/edited)
- `originalPrompt.text` (original AI prompt)

If they differ, `wasEdited = true`.

## Edit Similarity

The backend calculates similarity between original and sent message:

```python
# Simple character-based similarity
original_lower = original_prompt_text.lower().strip()
sent_lower = sent_message_text.lower().strip()
common_chars = sum(1 for c in original_lower if c in sent_lower)
similarity = common_chars / max(len(original_lower), len(sent_lower), 1)
```

- `1.0` = Identical (not edited)
- `0.0-0.99` = Edited (lower = more changes)

## Storage

Analytics are stored in Azure Cosmos DB in the `analytics` container:

- **Partition Key**: `userId`
- **Type**: `prompt_usage`
- **Schema**: See `track_prompt_usage()` in `azure_storage.py`

## Use Cases

### Measuring Engagement
- **High edit rate** (>50%): Users want more control, prompts might need refinement
- **Low edit rate** (<20%): Prompts are good, users trust them
- **High usage**: Feature is valuable

### Improving Prompts
- Track which prompts get edited most
- Identify patterns in edits
- Refine prompt generation based on user preferences

### User Satisfaction
- Users editing prompts = they're engaging with the feature
- Users sending as-is = prompts match their style well

## Privacy

- Only tracks metadata (prompt IDs, edit status)
- Does NOT store full message content in analytics
- Message content stored locally only (see `PRIVACY_ARCHITECTURE.md`)

## Future Enhancements

1. **Prompt Performance**: Track which prompt types perform best
2. **Edit Patterns**: Analyze what users change most
3. **A/B Testing**: Test different prompt styles
4. **User Feedback**: Add explicit "thumbs up/down" for prompts
5. **Time-based Analysis**: Track usage over time

