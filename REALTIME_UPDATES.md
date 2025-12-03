# Real-Time Graph Updates

## How the Graph Updates in Real-Time

### 1. **Automatic Recalculation**

The graph automatically recalculates when contacts change because:

```typescript
// graphData depends on filteredContacts
const graphData = useMemo(() => {
  // ... graph generation logic
}, [filteredContacts]); // ← Recalculates when filteredContacts changes
```

**What triggers recalculation:**
- When `contacts` state updates (new messages, sync, etc.)
- When `searchQuery` changes (filters contacts)
- When `activeFilter` changes (filters contacts)

### 2. **Frequency Normalization (Scales Dynamically)**

Frequency is normalized across all contacts to ensure line thickness scales properly:

```typescript
// Step 1: Extract raw frequencies
const rawFrequencies = filteredContacts.map(c => {
  if (c.frequency !== undefined) return c.frequency;
  if (c.metrics?.interactionFrequency !== undefined) {
    return Math.min(1.0, c.metrics.interactionFrequency / FREQUENCY_MAX_MSG_PER_DAY);
  }
  return 0;
});

// Step 2: Normalize relative to max frequency
const maxFrequency = Math.max(...rawFrequencies, 0.001);
const normalizedFrequencies = rawFrequencies.map(freq => 
  maxFrequency > 0 ? freq / maxFrequency : 0
);
```

**Why this matters:**
- If Contact A sends 5 messages/day and Contact B sends 1 message/day:
  - Before normalization: A = 1.0, B = 0.2 (absolute scale)
  - After normalization: A = 1.0, B = 0.2 (relative scale)
- If Contact C starts sending 10 messages/day:
  - Before: A = 1.0, B = 0.2, C = 1.0 (capped at max)
  - After: A = 0.5, B = 0.1, C = 1.0 (scales relative to new max)
- **Result**: Line thickness always uses full range (thin to thick) based on current max

### 3. **Real-Time Update Flow**

```
User sends message
  ↓
Backend updates contact metrics (frequency, recency)
  ↓
Frontend syncs (handleSyncConversations)
  ↓
contacts state updates
  ↓
filteredContacts recalculates (useMemo)
  ↓
graphData recalculates (useMemo)
  ↓
Graph re-renders with new positions/thickness
```

### 4. **Manual Sync**

Users can manually sync to get latest data:

```typescript
const handleSyncConversations = async () => {
  setIsSyncing(true);
  try {
    await apiClient.syncConversations(user.id);
    // Refresh contacts after sync
    const contactsResponse = await apiClient.getContacts(user.id);
    if (contactsResponse.success && contactsResponse.data) {
      setContacts(contactsResponse.data.contacts); // ← Triggers graph update
    }
  } finally {
    setIsSyncing(false);
  }
};
```

### 5. **What Updates Automatically**

When contacts change, the following update automatically:

1. **Node positions**: Recalculated based on new recency values
2. **Line thickness**: Recalculated based on normalized frequency
3. **Line opacity**: Recalculated based on normalized frequency
4. **Angular spacing**: Recalculated if number of contacts changes

### 6. **Example: Real-Time Scenario**

**Initial state:**
- Contact A: 5 msgs/day, 2 days ago → frequency=1.0, recency=0.02
- Contact B: 1 msg/day, 10 days ago → frequency=0.2, recency=0.11

**After Contact A sends 10 more messages:**
- Contact A: 15 msgs/day, 1 day ago → frequency=1.0 (new max), recency=0.01
- Contact B: 1 msg/day, 10 days ago → frequency=0.067 (scaled down), recency=0.11

**Visual changes:**
- Contact A: Moves closer (recency decreased), line stays thick (still max)
- Contact B: Stays same distance, line gets thinner (frequency scaled down)

### 7. **Performance**

- `useMemo` prevents unnecessary recalculations
- Graph only recalculates when `filteredContacts` actually changes
- React handles re-rendering efficiently
- No force simulation overhead (all positions fixed)

