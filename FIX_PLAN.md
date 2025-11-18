# Fix Plan: Critical Issues Resolution

## Overview

This document outlines the plan to fix 5 critical issues identified in the SIMT application:
1. Inaccurate prompt generation (no user vs contact message tracking)
2. Contacts displaying as phone numbers instead of names
3. Leaf clicks not navigating to conversation view
4. No visual variation in branch length/thickness
5. All leaves yellow, no relationship health indication

---

## Issue 1: Inaccurate Prompt Generation

### Problem
When generating AI prompts, the system doesn't properly track which messages are from the user vs the contact. This leads to prompts that don't understand conversation context correctly.

### Root Cause
- Messages are fetched from iMessage with `isFromMe` flag
- When stored in Conversation model, messages array is empty (privacy)
- When generating prompts, messages are re-fetched but sender tracking may be lost
- The `_prepare_context()` method in `ai_service.py` doesn't properly distinguish user vs contact messages

### Solution

**Step 1.1: Fix Message Fetching for Prompt Generation**
- **File**: `backend/app/routes/conversations.py` → `get_conversation_prompts()`
- **Action**: When fetching messages for prompt generation, ensure `isFromMe` flag is preserved
- **Code Location**: Around line 400-500 in conversations.py

```python
# When fetching messages for prompt generation:
messages = await imessage_service.get_messages(chat_id, limit=20)
# Ensure each message has isFromMe flag preserved
for msg in messages:
    msg['isFromMe'] = msg.get('isFromMe', False)  # Explicitly preserve
```

**Step 1.2: Update Context Preparation**
- **File**: `backend/app/services/ai_service.py` → `_prepare_context()`
- **Action**: Properly label messages as "You:" vs "Contact:" based on `isFromMe`
- **Current Issue**: Line 318 uses `msg.sender` which might be inconsistent

```python
def _prepare_context(self, conversation: Conversation, max_messages: int = 20) -> str:
    # Get recent messages from iMessage (fresh fetch)
    recent_messages = conversation.get_last_n_messages(max_messages)
    
    # Format context with proper sender labels
    for msg in recent_messages:
        if msg.sender == 'user' or msg.sender == conversation.user_id:
            context_parts.append(f"You: {msg.content[:200]}")
        else:
            context_parts.append(f"{conversation.partner_name}: {msg.content[:200]}")
```

**Step 1.3: Fix Message Processing in Sync**
- **File**: `backend/app/services/imessage_service.py` → `process_chat()` (line 516-521)
- **Action**: Ensure sender is consistently set to 'user' for user messages
- **Current Code**: Already sets `sender = 'user'` for `isFromMe=True`, but verify it's used correctly

**Step 1.4: Update Conversation Model**
- **File**: `backend/app/models/__init__.py` → `Conversation.get_last_n_messages()`
- **Action**: When fetching messages for prompt generation, ensure they include sender info
- **Note**: Messages are fetched fresh from iMessage, so this should work, but need to verify

### Testing
1. Sync a conversation with messages
2. Generate prompts
3. Verify prompts reference correct conversation context
4. Check that prompts understand who said what

---

## Issue 2: Contacts Displaying as Phone Numbers

### Problem
Contacts are showing as phone numbers (e.g., "+1234567890") instead of names (e.g., "John Smith") in the grove visualization.

### Root Cause
- Name inference is happening during sync (`name_inference.py`)
- But the inferred name might not be saved to the conversation's `partner_name` field
- Or the name is being saved but not returned in the contacts API response

### Solution

**Step 2.1: Verify Name is Saved During Sync**
- **File**: `backend/app/services/imessage_service.py` → `process_chat()` (line 447-465)
- **Action**: Ensure `chat_name` from name inference is actually used when creating conversation
- **Current Code**: Line 585 uses `partner_name=chat_name`, which should work
- **Debug**: Add logging to verify `chat_name` is not None/phone number

```python
# After name inference (line 447-465):
chat_name = name_service.infer_and_format_display_name(...)
logger.info(f"[SYNC] Chat #{idx}: Inferred name: '{chat_name}' for chatId: {chat_id}")

# Verify it's not just contact info
if name_service._is_just_contact_info(chat_name):
    logger.warning(f"[SYNC] Chat #{idx}: Name '{chat_name}' is just contact info, trying AI inference again")
    # Try AI inference again with more messages
```

**Step 2.2: Fix Contacts API Response**
- **File**: `backend/app/routes/contacts.py` → `get_contacts()` (line 127)
- **Action**: Ensure `get_partner_name()` is correctly extracting name from conversation
- **Current Code**: Line 127 uses `get_partner_name(conv) or 'Unknown'`
- **Issue**: `get_partner_name()` might be returning phone number if `partner_name` field contains phone

```python
# In get_contacts(), line 127:
partner_name = get_partner_name(conv) or conv.get('partnerName') or conv.get('partner_name')
# If it's still a phone number, try to extract from chatId
if partner_name and ('+' in partner_name or '@' in partner_name):
    # It's a phone/email, try to get better name
    # Check if we have a saved name somewhere else
    partner_name = conv.get('displayName') or partner_name
```

**Step 2.3: Improve Name Inference Fallback**
- **File**: `backend/app/services/name_inference.py` → `infer_and_format_display_name()`
- **Action**: Add more aggressive AI inference if initial attempt returns phone number
- **Current Code**: Lines 108-127 have fallback, but might not be aggressive enough

```python
# After Tier 2 (AI inference), if result is still contact info:
if inferred and self._is_just_contact_info(inferred):
    # Try again with more messages (last 50 instead of 20)
    logger.info(f"AI returned contact info '{inferred}', trying with more context")
    inferred = self.infer_name_from_messages(messages[-50:], phone_number)
```

**Step 2.4: Add Name Refresh Endpoint**
- **File**: `backend/app/routes/contacts.py`
- **Action**: Add endpoint to re-infer names for contacts that are still phone numbers
- **New Endpoint**: `POST /api/contacts/:id/refresh-name`

### Testing
1. Sync conversations
2. Check contacts API response - verify names are present
3. If names are phone numbers, check logs for name inference
4. Test name refresh endpoint

---

## Issue 3: Leaf Clicks Not Navigating

### Problem
Clicking on leaves in the grove doesn't navigate to the conversation view where users can send prompts.

### Root Cause
- `GroveDashboard.tsx` has `handleLeafClick()` that sets `selectedContact`
- But it doesn't call `onContactSelect()` which triggers navigation
- The leaf component calls `onClick` which triggers `handleLeafClick`, but navigation never happens

### Solution

**Step 3.1: Fix Leaf Click Handler**
- **File**: `FigmaFrontEnd/src/components/GroveDashboard.tsx` → `handleLeafClick()` (line 209)
- **Action**: Directly call `onContactSelect()` instead of just setting state

```typescript
const handleLeafClick = (contact: Contact) => {
  console.log('[GROVE] Leaf clicked:', contact.name, contact.id);
  // Directly navigate to conversation view
  onContactSelect(contact);
};
```

**Step 3.2: Remove Unused Modal Code**
- **File**: `FigmaFrontEnd/src/components/GroveDashboard.tsx`
- **Action**: Remove `selectedContact` state and `handleCloseModal()` / `handleSendMessage()` if they're not used
- **Current Code**: Lines 24, 216-225 might be unused

**Step 3.3: Verify Leaf Component onClick**
- **File**: `FigmaFrontEnd/src/components/GroveLeaf.tsx` → `onClick` handler (line 111, 227)
- **Action**: Ensure `onClick` is properly called and not prevented by event bubbling
- **Current Code**: Already has `e.stopPropagation()`, which is good

### Testing
1. Click on a leaf in the grove
2. Verify it navigates to ConversationView
3. Verify the correct contact is selected
4. Verify prompts are shown for that contact

---

## Issue 4: No Visual Variation in Branch Length/Thickness

### Problem
All branches connecting the user (center) to contacts have the same length and thickness, not reflecting recency and frequency.

### Root Cause
- `layoutContacts()` function calculates `lineThickness` and `branchLength` (lines 158-171)
- But these values might not be used when rendering the branches in the SVG
- Need to check if branches are actually rendered with these properties

### Solution

**Step 4.1: Verify Branch Rendering**
- **File**: `FigmaFrontEnd/src/components/GroveDashboard.tsx`
- **Action**: Find where branches are rendered in the SVG (should be around line 600+)
- **Issue**: Branches might not be rendered at all, or rendered with fixed values

**Step 4.2: Add Branch Rendering**
- **File**: `FigmaFrontEnd/src/components/GroveDashboard.tsx`
- **Action**: Render branches (lines) from center to each contact using calculated properties
- **Location**: After center "You" element, before leaves

```typescript
{/* Render branches from center to each contact */}
{layoutedContacts.map((contact, i) => {
  const centerX = 500;
  const centerY = 200; // Match center position
  return (
    <line
      key={`branch-${contact.id}`}
      x1={centerX}
      y1={centerY}
      x2={contact.x}
      y2={contact.y}
      stroke="#78350f" // Brown branch color
      strokeWidth={contact.lineThickness || 2}
      strokeLinecap="round"
      opacity={0.6}
      style={{ zIndex: 0 }} // Behind leaves
    />
  );
})}
```

**Step 4.3: Verify Calculations**
- **File**: `FigmaFrontEnd/src/components/GroveDashboard.tsx` → `layoutContacts()` (lines 108-184)
- **Action**: Verify `recency` and `frequency` values are coming from backend
- **Current Code**: Lines 117-147 normalize values, but need to verify backend sends them

**Step 4.4: Check Backend Sends Recency/Frequency**
- **File**: `backend/app/routes/contacts.py` → `get_contacts()` (lines 133-134)
- **Action**: Verify `recency` and `frequency` are included in contact object
- **Current Code**: Lines 133-134 set these, should be fine

### Testing
1. Load grove with multiple contacts
2. Verify branches have different lengths (recent = shorter, old = longer)
3. Verify branches have different thicknesses (frequent = thicker, infrequent = thinner)
4. Verify visual matches calculated values

---

## Issue 5: All Leaves Yellow, No Health Indication

### Problem
All leaves appear yellow and don't reflect relationship health (healthy = green, attention = orange, dormant = pink, wilted = brown).

### Root Cause
- `GroveLeaf.tsx` has color logic based on `status` prop (lines 31-59)
- But `status` might not be passed correctly from `GroveDashboard`
- Or all contacts have the same status (likely 'attention' or default)

### Solution

**Step 5.1: Verify Status is Passed to Leaf**
- **File**: `FigmaFrontEnd/src/components/GroveDashboard.tsx`
- **Action**: Find where `GroveLeaf` is rendered and verify `status` prop is passed
- **Location**: Should be around line 650-700

```typescript
{layoutedContacts.map((contact) => (
  <GroveLeaf
    key={contact.id}
    name={contact.name}
    category={contact.category}
    status={contact.status} // Verify this is passed
    size={contact.size || 0.5}
    x={contact.x}
    y={contact.y}
    rotation={contact.rotation}
    onClick={() => handleLeafClick(contact)}
    season={season}
  />
))}
```

**Step 5.2: Verify Status Calculation**
- **File**: `backend/app/routes/contacts.py` → `get_contacts()` (lines 109-122)
- **Action**: Verify status calculation is correct and not defaulting to same value
- **Current Code**: Calculates `relationship_health` based on frequency + recency
- **Issue**: Logic might be too lenient, defaulting most to 'healthy'

```python
# More strict status calculation:
if days_since_contact > 60:
    relationship_health = 'wilted'
elif days_since_contact > 30:
    relationship_health = 'dormant'
elif days_since_contact > 14:
    relationship_health = 'attention'
else:
    relationship_health = 'healthy'
```

**Step 5.3: Use Conversation's get_relationship_health()**
- **File**: `backend/app/routes/contacts.py` → `get_contacts()`
- **Action**: Use the Conversation model's `get_relationship_health()` method instead of recalculating
- **Current Code**: Lines 109-122 recalculate, but Conversation model has this method

```python
# Instead of recalculating, use the conversation's method:
from app.models import Conversation
conv_obj = Conversation.from_dict(conv)
relationship_health = conv_obj.get_relationship_health()
```

**Step 5.4: Debug Status Values**
- **File**: `FigmaFrontEnd/src/components/GroveDashboard.tsx`
- **Action**: Add console logging to see what status values are received

```typescript
console.log('[GROVE] Contact statuses:', 
  layoutedContacts.map(c => ({ name: c.name, status: c.status }))
);
```

### Testing
1. Sync conversations with different recency (some recent, some old)
2. Check contacts API response - verify status values vary
3. Check grove visualization - verify leaves have different colors
4. Verify colors match: green (healthy), orange (attention), pink (dormant), brown (wilted)

---

## Implementation Priority

### Phase 1: Critical Fixes (Do First)
1. **Issue 3**: Leaf clicks not navigating (quick fix, high impact)
2. **Issue 5**: All leaves yellow (quick fix, high visual impact)
3. **Issue 2**: Contacts as phone numbers (user experience)

### Phase 2: Core Functionality
4. **Issue 1**: Inaccurate prompt generation (requires careful testing)
5. **Issue 4**: Branch visual variation (enhancement, but important for UX)

---

## Testing Checklist

After implementing fixes:

- [ ] Leaf clicks navigate to conversation view
- [ ] Leaves show correct colors (green/orange/pink/brown) based on health
- [ ] Contacts display with names (not phone numbers)
- [ ] Branches have varying lengths (recent = shorter)
- [ ] Branches have varying thicknesses (frequent = thicker)
- [ ] AI prompts reference correct conversation context
- [ ] Prompts understand who said what (user vs contact)

---

## Files to Modify

### Backend
1. `backend/app/services/ai_service.py` - Fix context preparation
2. `backend/app/routes/conversations.py` - Fix message fetching for prompts
3. `backend/app/routes/contacts.py` - Fix status calculation, name extraction
4. `backend/app/services/imessage_service.py` - Verify name saving
5. `backend/app/services/name_inference.py` - Improve name inference

### Frontend
1. `FigmaFrontEnd/src/components/GroveDashboard.tsx` - Fix leaf clicks, add branch rendering, verify status passing
2. `FigmaFrontEnd/src/components/GroveLeaf.tsx` - Verify onClick works (should be fine)

---

## Estimated Time

- **Issue 3**: 30 minutes (simple fix)
- **Issue 5**: 1 hour (verify status calculation and passing)
- **Issue 2**: 2-3 hours (debug name inference and saving)
- **Issue 4**: 1-2 hours (add branch rendering)
- **Issue 1**: 2-3 hours (fix message tracking and context)

**Total**: ~7-10 hours

---

## Notes

- All fixes should be tested individually before moving to next issue
- Use console logging extensively to debug
- Verify data flow: Backend → API → Frontend → Display
- Check browser console for errors
- Check backend logs for warnings/errors

