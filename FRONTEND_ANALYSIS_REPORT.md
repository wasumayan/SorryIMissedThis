# Frontend Analysis Report: GroveDashboard, Analytics, ConversationView

## Executive Summary

This report analyzes three critical frontend components for hardcoded values, inconsistencies, logic errors, and provides a detailed explanation of how everything works. The analysis reveals multiple hardcoded values that should be constants, inconsistent center positioning, and potential logic issues.

---

## 1. GroveDashboard.tsx Analysis

### 1.1 Hardcoded Values Found

#### **CRITICAL: Center Position Inconsistency**
- **Location**: Multiple places
- **Issue**: Center position is hardcoded as `(500, 400)` in multiple places but `layoutContacts()` uses `centerY = 400` which matches, BUT the viewBox and other calculations use different values
- **Hardcoded Values**:
  - Line 109-110: `centerX = 500`, `centerY = 400` (in layoutContacts)
  - Line 455: `cx="500" cy="400"` (glow effect)
  - Line 458: `translate(500, 400)` (watering can)
  - Line 525-527: `x="500" y="455"` ("You" label - 55px below center)
  - Line 541-542: `x="500" y="320"` (loading text - 80px above center)
  - Line 552-553: `cx="500" cy="350"` (loading circle - 50px above center)
  - Line 578-579: `x="500" y="310"` (empty state text - 90px above center)
  - Line 589-590: `x="500" y="340"` (empty state subtitle - 60px above center)
  - Line 615-616: `x1="500" y1="400"` (branch lines - matches center)
  - Line 252-253: `viewBoxWidth = 1000 / zoomLevel`, `viewBoxHeight = 700 / zoomLevel` (hardcoded dimensions)
  - Line 258-259: `newViewBoxWidth = 1000 / newZoom`, `newViewBoxHeight = 700 / newZoom`
  - Line 418: `viewBox={`${0 - panX} ${0 - panY} ${1000 / zoomLevel} ${800 / zoomLevel}`}` (800 height doesn't match 700 above!)

#### **Distance/Size Constants**
- Line 158-159: `minDistance = 150`, `maxDistance = 200` (branch length range)
- Line 169-170: `minThickness = 2`, `maxThickness = 8` (branch thickness range)
- Line 121: `daysSinceContact / 90.0` (normalization factor - 90 days)
- Line 130: `interactionFrequency / 5.0` (normalization factor - 5 msg/day max)
- Line 236: `zoomSensitivity = 0.05` (zoom increment)
- Line 240: `Math.max(0.5, Math.min(2, ...))` (zoom min/max: 0.5x to 2x)
- Line 382: `zoomLevel + 0.1` (zoom in increment)
- Line 394: `zoomLevel - 0.1` (zoom out increment)

#### **Color Values**
- Line 445-446: `stopColor="#06b6d4"` (water glow colors)
- Line 449-450: `stopColor="#67e8f9"`, `stopColor="#06b6d4"` (water gradient)
- Line 465: `fill="#78716c"` (can body color)
- Line 493: `fill="#57534e"` (can rim color)
- Line 619: `stroke="#78350f"` (branch color)
- Line 653: `bg-[#10b981]` (healthy color)
- Line 657: `bg-[#f59e0b]` (attention color)
- Line 661: `bg-[#ec4899]` (dormant color)
- Line 665: `bg-[#78350f]` (wilted color)
- Line 700-703: Priority colors: `'#f59e0b'`, `'#06b6d4'`, `'#10b981'`

#### **Layout/Spacing**
- Line 89: `filters = ["All", "Family", "Friends", "Work", "Dormant", "Priority"]`
- Line 680: `w-80` (right panel width - 320px)
- Line 699: `suggestions.slice(0, 3)` (max 3 suggestions shown)
- Line 761: `.slice(0, 3)` (max 3 dormant contacts shown)

#### **Font Sizes (inline styles)**
- Line 648: `fontSize: '0.75rem'`
- Line 654, 658, 662, 666: `fontSize: '0.75rem'`
- Line 670-672: `fontSize: '0.7rem'`
- Line 689: `fontSize: '0.875rem'`
- Line 726-727: `fontSize: '0.875rem'`
- Line 729: `fontSize: '0.75rem'`
- Line 750: `fontSize: '0.75rem'`
- Line 754: `fontSize: '0.875rem'`
- Line 776: `fontSize: '0.875rem'`

### 1.2 Logic Issues

#### **Issue 1: ViewBox Height Mismatch**
- **Line 252**: `viewBoxHeight = 700 / zoomLevel`
- **Line 418**: `viewBox={... ${800 / zoomLevel}}` (uses 800, not 700!)
- **Impact**: ViewBox calculations will be incorrect, causing zoom/pan issues

#### **Issue 2: Angle Calculation**
- **Line 151**: `angleDegrees = (-180 / totalContacts) * i`
- **Issue**: This only distributes contacts in a 180-degree arc (semicircle), not full 360 degrees
- **Expected**: Should be `(360 / totalContacts) * i` for full circle

#### **Issue 3: Normalization Logic**
- **Lines 136-137**: `maxRecency = Math.max(...recencies, 1)`, `maxFrequency = Math.max(...frequencies, 1)`
- **Issue**: If all contacts have recency/frequency of 0, max will be 1 (from fallback), causing division issues
- **Better**: Should handle case where max is 0

#### **Issue 4: Opacity Calculation**
- **Line 608**: `opacity = 0.4 + frequencyNormalized * 0.5` (range: 0.4-0.9)
- **Issue**: Hardcoded min/max opacity values

### 1.3 How GroveDashboard Works

#### **Data Flow**
1. **Mount**: `useEffect` (line 35) fetches contacts and suggestions
2. **Filtering**: `filteredContacts` (line 92) filters by search query and active filter
3. **Layout**: `layoutContacts()` (line 108) calculates positions for each contact:
   - **Angle**: Evenly distributed in semicircle (180 degrees)
   - **Distance**: Based on recency (recent = closer, old = farther)
   - **Thickness**: Based on frequency (frequent = thicker)
4. **Rendering**: Maps through `layoutedContacts` to render branches and leaves

#### **Layout Algorithm**
```
For each contact:
  1. Calculate angle: (-180 / total) * index (semicircle distribution)
  2. Calculate distance: minDistance + (recency * (maxDistance - minDistance))
     - Recent contacts (recency = 0) → distance = 150px (close)
     - Old contacts (recency = 1) → distance = 200px (far)
  3. Calculate position: center + (cos(angle) * distance, sin(angle) * distance)
  4. Calculate branch thickness: minThickness + (frequency * (maxThickness - minThickness))
```

#### **Zoom/Pan System**
- **Zoom**: Mouse wheel adjusts `zoomLevel` (0.5x to 2x)
- **Pan**: Mouse drag adjusts `panX` and `panY`
- **ViewBox**: `viewBox={`${0 - panX} ${0 - panY} ${1000 / zoomLevel} ${800 / zoomLevel}`}`
- **Issue**: Height mismatch (700 vs 800)

#### **Click Handling**
- **Leaf Click**: Calls `handleLeafClick()` → `onContactSelect(contact)` → navigates to ConversationView
- **Prompt Click**: Finds contact and calls `handleLeafClick()`

---

## 2. Analytics.tsx Analysis

### 2.1 Hardcoded Values Found

#### **SVG Dimensions**
- Line 139: `width="400" height="400"` (growth rings SVG)
- Line 139: `viewBox="0 0 400 400"`
- Line 152: `cx="200" cy="200"` (center of rings)
- Line 142: `radius = 60 + index * 40` (ring radius calculation)
  - Starting radius: 60
  - Increment per ring: 40
- Line 145: `strokeWidth = 25` (ring thickness)

#### **Color Values**
- Line 76: `borderColor: '#06b6d420'` (total messages card)
- Line 90: `borderColor: '#10b98120'` (avg response time card)
- Line 104: `borderColor: '#8b5cf620'` (active contacts card)
- Line 92: `from-[#10b981] to-[#10b981]/50` (gradient)
- Line 106: `from-[#8b5cf6] to-[#8b5cf6]/50` (gradient)
- Line 120: `bg-[#fbbf24]/10`, `text-[#fbbf24]` (trending card)
- Line 127: `text-[#10b981]` (conversations count)
- Line 211: `border-l-4 border-[#10b981]` (revived connections)
- Line 213: `text-[#10b981]` (icon color)
- Line 223: `text-[#10b981]` (message count)
- Line 234: `border-l-4 border-[#fbbf24]` (health breakdown)
- Line 236: `text-[#fbbf24]` (icon color)
- Line 254: `border-l-4 border-primary` (communication trends)
- Line 287: `colors = ["#0d9488", "#10b981", "#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899"]` (topic colors)

#### **Layout/Spacing**
- Line 75: `grid-cols-1 md:grid-cols-4` (responsive grid)
- Line 68: `max-w-6xl` (max width)
- Line 220: `trends.revivedConnections.slice(0, 2)` (max 2 revived)
- Line 243: `trends.healthTrends.slice(0, 2)` (max 2 health trends)
- Line 263: `trends.communicationTrends.slice(0, 2)` (max 2 communication trends)

#### **Font Sizes (inline styles)**
- Line 59: `fontSize: '0.875rem'`
- Line 82: `fontSize: '0.875rem'`
- Line 99: `fontSize: '0.875rem'`
- Line 110: `fontSize: '0.875rem'`
- Line 124: `fontSize: '0.875rem'`
- Line 180: `fontSize="11"`
- Line 201: `fontSize: '0.875rem'`
- Line 216: `fontSize: '0.875rem'`
- Line 222: `fontSize: '0.875rem'`
- Line 223: `fontSize: '0.875rem'`
- Line 239: `fontSize: '0.875rem'`
- Line 245: `fontSize: '0.875rem'`
- Line 246: `fontSize: '0.875rem'`
- Line 259: `fontSize: '0.875rem'`
- Line 265: `fontSize: '0.875rem'`
- Line 268: `fontSize: '0.875rem'`
- Line 282: `fontSize: '0.875rem'`
- Line 296: `fontSize: '0.875rem'`
- Line 297: `fontSize: '0.875rem'`

#### **Ring Calculation Constants**
- Line 173: `opacity={0.7 + intensity * 0.3}` (opacity range: 0.7-1.0)
- Line 189: `r="35"` (center circle radius)

### 2.2 Logic Issues

#### **Issue 1: Growth Rings Center**
- **Line 152**: `cx="200" cy="200"` (hardcoded center)
- **Line 139**: SVG is `400x400`, so center is correct
- **No Issue**: This is fine, but should be a constant

#### **Issue 2: Ring Radius Calculation**
- **Line 142**: `radius = 60 + index * 40`
- **Issue**: If there are many weeks, rings will overflow SVG bounds
- **Better**: Should calculate max radius based on SVG size

#### **Issue 3: Font Size Inconsistency**
- Multiple inline `style={{ fontSize: '0.875rem' }}` throughout
- Should use Tailwind classes or CSS variables

### 2.3 How Analytics Works

#### **Data Flow**
1. **Mount**: `useEffect` (line 19) fetches overview and trends in parallel
2. **Period Selection**: `period` state (default: '30d') controls data range
3. **Rendering**: Displays stats cards, growth rings, and trend cards

#### **Growth Rings Algorithm**
```
For each week:
  1. Calculate radius: 60 + (week_index * 40)
  2. Calculate circumference: 2 * π * radius
  3. Calculate intensity: week.messages / maxMessages (0-1)
  4. Calculate stroke offset: circumference * (1 - intensity)
  5. Render ring with dasharray = circumference, dashoffset = offset
```

#### **Visualization Logic**
- **Ring Intensity**: More messages = more filled ring
- **Ring Size**: Each week is a larger concentric circle
- **Center**: Shows total number of weeks

---

## 3. ConversationView.tsx Analysis

### 3.1 Hardcoded Values Found

#### **Tone Slider**
- Line 53: `tone = [50]` (default tone value, 0-100 scale)
- Line 275-278: `getToneName()` thresholds: `< 33` = Formal, `< 66` = Friendly, else Playful
- Line 664: `max={100}`, `step={1}` (slider config)

#### **Message Display**
- Line 471: `max-w-[70%]` (message bubble max width)
- Line 432: `[1, 2, 3, 4, 5]` (reciprocity bars - hardcoded 5 bars)
- Line 436: `i <= Math.round(reciprocity * 5)` (reciprocity calculation)

#### **Layout/Spacing**
- Line 495: `w-full lg:w-[480px]` (right panel width - 480px on large screens)
- Line 630: `rows={4}` (textarea rows)
- Line 152: `num_prompts: 3` (default number of prompts to generate)

#### **Time Formatting**
- Line 253: `diffDays < 7` (days threshold)
- Line 258: `diffDays < 30` (weeks threshold)
- Line 259: `diffDays < 365` (months threshold)
- Line 269: `days < 7` (same thresholds in formatDaysAgo)

#### **Font Sizes (inline styles)**
- Line 425: `fontSize: '0.875rem'`
- Line 430: `fontSize: '0.75rem'`
- Line 477: `fontSize: '0.9375rem'`
- Line 482: `fontSize: '0.75rem'`
- Line 498: `fontSize: '0.875rem'`
- Line 584: `fontSize: '0.9375rem'`
- Line 587: `fontSize: '0.75rem'`
- Line 612: `fontSize: '0.75rem'`
- Line 617: `fontSize: '0.75rem'`
- Line 668: `fontSize: '0.75rem'`
- Line 685: `fontSize: '0.875rem'`
- Line 734: `fontSize: '0.75rem'`

#### **Delays/Timeouts**
- Line 372: `setTimeout(..., 2000)` (2 second delay before navigating back)

### 3.2 Logic Issues

#### **Issue 1: Tone Slider Not Used**
- **Line 53**: `tone` state is set but **NEVER USED** in prompt generation!
- **Line 662**: Slider updates `tone` state
- **Line 152**: `generateNewPrompts()` doesn't pass tone to API
- **Impact**: Tone slider is completely non-functional

#### **Issue 2: Message Sender Detection**
- **Line 102**: `msg.sender === userId || msg.sender.toLowerCase() === 'user'`
- **Issue**: Inconsistent sender identification logic
- **Better**: Should use consistent 'user' identifier

#### **Issue 3: Prompt Selection**
- **Line 51**: `selectedPrompt = 0` (defaults to first prompt)
- **Line 122**: Sets `customPrompt` to first prompt text
- **Issue**: If prompts are dismissed, selectedPrompt might point to dismissed prompt

#### **Issue 4: Empty Message Check**
- **Line 305**: `if (!messageToSend.trim())`
- **Issue**: Should also check if customPrompt is empty when no prompt selected

### 3.3 How ConversationView Works

#### **Data Flow**
1. **Mount**: `useEffect` (line 68) fetches:
   - Conversation details (parallel)
   - Prompts (parallel)
   - Summary (parallel, optional)
2. **Messages**: Loaded from `localMessageStorage` (local storage)
3. **Prompts**: Displayed in cards, user can select/edit
4. **Send**: Validates message, sends via iMessage API, logs metrics

#### **Prompt Selection Logic**
- User clicks prompt card → sets `selectedPrompt` index
- Updates `customPrompt` textarea with prompt text
- User can edit textarea to customize
- On send, checks if edited (`wasEdited` flag)

#### **Message Display**
- Messages mapped from local storage
- Sender detection: `userId` or 'user' = user message (right-aligned, primary color)
- Other senders = contact message (left-aligned, muted color)

---

## 4. Recommended Constants File

Create a constants file to replace all hardcoded values:

```typescript
// constants/grove.ts
export const GROVE_CONSTANTS = {
  // Center position (should be single source of truth)
  CENTER_X: 500,
  CENTER_Y: 400,
  
  // SVG dimensions
  SVG_WIDTH: 1000,
  SVG_HEIGHT: 800, // NOTE: Currently inconsistent (700 vs 800)
  
  // Branch layout
  MIN_BRANCH_DISTANCE: 150,
  MAX_BRANCH_DISTANCE: 200,
  MIN_BRANCH_THICKNESS: 2,
  MAX_BRANCH_THICKNESS: 8,
  
  // Normalization factors
  RECENCY_NORMALIZATION_DAYS: 90,
  FREQUENCY_MAX_MSG_PER_DAY: 5,
  
  // Zoom
  ZOOM_MIN: 0.5,
  ZOOM_MAX: 2,
  ZOOM_SENSITIVITY: 0.05,
  ZOOM_INCREMENT: 0.1,
  
  // Colors
  COLORS: {
    HEALTHY: '#10b981',
    ATTENTION: '#f59e0b',
    DORMANT: '#ec4899',
    WILTED: '#78350f',
    BRANCH: '#78350f',
    WATER_GLOW: '#06b6d4',
    WATER_GRADIENT_START: '#67e8f9',
    WATER_GRADIENT_END: '#06b6d4',
    CAN_BODY: '#78716c',
    CAN_RIM: '#57534e',
  },
  
  // Layout
  RIGHT_PANEL_WIDTH: 320, // w-80 = 20rem = 320px
  MAX_SUGGESTIONS_DISPLAYED: 3,
  MAX_DORMANT_DISPLAYED: 3,
  
  // Font sizes (should use Tailwind classes instead)
  FONT_SIZES: {
    XS: '0.75rem',
    SM: '0.875rem',
    BASE: '1rem',
  },
};

// constants/analytics.ts
export const ANALYTICS_CONSTANTS = {
  SVG_SIZE: 400,
  SVG_CENTER: 200,
  RING_START_RADIUS: 60,
  RING_INCREMENT: 40,
  RING_STROKE_WIDTH: 25,
  CENTER_CIRCLE_RADIUS: 35,
  RING_OPACITY_MIN: 0.7,
  RING_OPACITY_MAX: 1.0,
  MAX_REVIVED_DISPLAYED: 2,
  MAX_TRENDS_DISPLAYED: 2,
  TOPIC_COLORS: [
    '#0d9488', '#10b981', '#3b82f6', '#8b5cf6',
    '#06b6d4', '#f59e0b', '#ec4899'
  ],
};

// constants/conversation.ts
export const CONVERSATION_CONSTANTS = {
  DEFAULT_TONE: 50, // 0-100 scale
  TONE_THRESHOLDS: {
    FORMAL: 33,
    FRIENDLY: 66,
  },
  MESSAGE_BUBBLE_MAX_WIDTH: '70%',
  RECIPROCITY_BARS: 5,
  TEXTAREA_ROWS: 4,
  DEFAULT_PROMPT_COUNT: 3,
  NAVIGATE_BACK_DELAY: 2000, // ms
  TIME_THRESHOLDS: {
    DAYS: 7,
    WEEKS: 30,
    MONTHS: 365,
  },
};
```

---

## 5. Critical Issues Summary

### **CRITICAL BUGS**

1. **ViewBox Height Mismatch** (GroveDashboard.tsx)
   - Line 252: Uses `700` for calculations
   - Line 418: Uses `800` in viewBox
   - **Fix**: Use consistent value (recommend 800 to match SVG_HEIGHT)

2. **Angle Distribution** (GroveDashboard.tsx)
   - Line 151: Only distributes in 180-degree arc (semicircle)
   - **Fix**: Change to `(360 / totalContacts) * i` for full circle

3. **Tone Slider Not Functional** (ConversationView.tsx)
   - Tone state is never passed to prompt generation
   - **Fix**: Pass tone to `generateNewPrompts()` API call

4. **Center Position Hardcoded Everywhere**
   - Should use constants: `CENTER_X`, `CENTER_Y`
   - Currently: 500, 400 in 10+ places

### **MAJOR INCONSISTENCIES**

1. **Font Sizes**: 20+ inline `fontSize` styles instead of Tailwind classes
2. **Colors**: Hardcoded hex values instead of theme colors
3. **Magic Numbers**: 90 days, 5 msg/day, 150px, 200px, etc. should be constants
4. **ViewBox Dimensions**: Inconsistent between calculations and actual viewBox

### **LOGIC ISSUES**

1. **Normalization Edge Cases**: Doesn't handle max = 0 case
2. **Prompt Selection**: Can select dismissed prompts
3. **Message Validation**: Doesn't check all edge cases

---

## 6. How Everything Works (Detailed)

### GroveDashboard Component Flow

```
1. Component Mounts
   ↓
2. useEffect triggers (line 35)
   ↓
3. Fetch contacts (apiClient.getContacts)
   ↓
4. Fetch suggestions (apiClient.getDailySuggestions)
   ↓
5. Set contacts state
   ↓
6. Filter contacts (useMemo, line 92)
   - Filter by search query
   - Filter by active filter (All/Family/Friends/etc.)
   ↓
7. Layout contacts (layoutContacts function, line 108)
   - Calculate angle for each contact (semicircle distribution)
   - Calculate distance based on recency
   - Calculate branch thickness based on frequency
   - Return contacts with x, y, rotation, lineThickness
   ↓
8. Render SVG
   - Center: (500, 400) - watering can
   - Branches: Lines from (500, 400) to each contact's (x, y)
   - Leaves: GroveLeaf components at each contact position
   ↓
9. User Interactions
   - Click leaf → handleLeafClick → onContactSelect → navigate to ConversationView
   - Zoom: Mouse wheel → adjust zoomLevel (0.5-2x)
   - Pan: Mouse drag → adjust panX, panY
   - Search: Filter contacts by name
   - Filter: Filter by category/status
```

### Analytics Component Flow

```
1. Component Mounts
   ↓
2. useEffect triggers (line 19)
   ↓
3. Fetch analytics (parallel):
   - getAnalyticsOverview(userId, period)
   - getTrends(userId, period)
   ↓
4. Process data:
   - Calculate maxMessages for ring scaling
   - Format weekly activity for rings
   ↓
5. Render:
   - Stats cards (4 cards with metrics)
   - Growth rings (concentric circles, one per week)
   - Trend cards (revived, health, communication)
   - Topic diversity bars
```

### ConversationView Component Flow

```
1. Component Mounts
   ↓
2. useEffect triggers (line 68)
   ↓
3. Fetch data (parallel):
   - getConversation(conversationId, userId)
   - getConversationPrompts(conversationId)
   - getConversationSummary(conversationId, userId) [optional]
   ↓
4. Load messages from local storage
   ↓
5. Process prompts:
   - If prompts exist → display them
   - If no prompts → generateNewPrompts()
   ↓
6. User interactions:
   - Select prompt → updates customPrompt textarea
   - Edit textarea → sets isEditing flag
   - Adjust tone slider → updates tone state (BUT NOT USED!)
   - Click send → handleSendMessage()
     - Validates message
     - Sends via sendiMessage API
     - Logs study metrics
     - Navigates back after 2 seconds
```

---

## 7. Recommended Fixes Priority

### **P0 - Critical (Fix Immediately)**
1. Fix viewBox height mismatch (700 vs 800)
2. Fix angle distribution (180° → 360°)
3. Make tone slider functional
4. Create constants file and replace hardcoded center positions

### **P1 - High Priority**
5. Replace all inline fontSize with Tailwind classes
6. Replace hardcoded colors with theme constants
7. Fix normalization edge cases (max = 0)
8. Fix prompt selection logic (handle dismissed prompts)

### **P2 - Medium Priority**
9. Extract all magic numbers to constants
10. Fix message validation edge cases
11. Improve error handling
12. Add loading states for all async operations

---

## 8. File-by-File Breakdown

### GroveDashboard.tsx
- **Total Hardcoded Values**: ~50+
- **Critical Issues**: 4
- **Lines of Code**: 817
- **Key Functions**: 
  - `layoutContacts()` - Calculates contact positions
  - `handleWheel()` - Handles zoom
  - `handleLeafClick()` - Handles navigation
  - `handleSyncConversations()` - Syncs iMessage

### Analytics.tsx
- **Total Hardcoded Values**: ~30+
- **Critical Issues**: 1 (ring radius overflow)
- **Lines of Code**: 323
- **Key Functions**:
  - Growth rings rendering (lines 141-187)
  - Stats cards rendering (lines 75-131)

### ConversationView.tsx
- **Total Hardcoded Values**: ~25+
- **Critical Issues**: 1 (tone slider not used)
- **Lines of Code**: 750
- **Key Functions**:
  - `generateNewPrompts()` - Generates AI prompts
  - `handleSendMessage()` - Sends message via iMessage
  - `formatTimestamp()` - Formats message timestamps
  - `formatDaysAgo()` - Formats relative time

---

## 9. Testing Checklist

After fixes, test:

- [ ] Grove renders with contacts at correct positions
- [ ] Branches have varying lengths (recent = shorter)
- [ ] Branches have varying thicknesses (frequent = thicker)
- [ ] Leaves show correct colors (green/orange/pink/brown)
- [ ] Zoom works correctly (0.5x to 2x)
- [ ] Pan works correctly (drag to move)
- [ ] Leaf clicks navigate to ConversationView
- [ ] Analytics growth rings render correctly
- [ ] ConversationView tone slider affects prompt generation
- [ ] Messages display correctly (user vs contact)
- [ ] Prompts can be selected, edited, and sent

---

## 10. Next Steps

1. Create constants file with all hardcoded values
2. Fix critical bugs (viewBox, angle, tone)
3. Replace inline styles with Tailwind classes
4. Extract colors to theme constants
5. Test thoroughly after each fix
6. Document any remaining hardcoded values with reasons

