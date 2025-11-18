# Graph Generation Logic

## Overview

The grove visualization uses `react-force-graph-2d` to create a force-directed graph where:
- **Center node ("You")** is fixed at the center
- **Contact nodes** are positioned around the center based on relationship metrics
- **Branches (links)** connect the center to each contact

---

## 1. Data Flow: How Contacts Are Added

### Step 1: Fetching Contacts (Lines 58-111)

```typescript
// GroveDashboard.tsx:58-111
useEffect(() => {
  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch contacts from API
    const contactsResponse = await apiClient.getContacts(user.id);
    
    if (contactsResponse.success && contactsResponse.data) {
      const contactsList = contactsResponse.data.contacts || [];
      setContacts(contactsList); // ← Contacts stored in state
    } else {
      setContacts([]);
    }
    
    setIsLoading(false);
  };
  
  fetchData();
}, [user.id]); // Re-fetch when user changes
```

**Key Points:**
- Contacts are fetched when component mounts or `user.id` changes
- Contacts stored in `contacts` state array
- Each contact has: `id`, `name`, `status`, `category`, `recency`, `frequency`, `size`, etc.

---

## 2. Filtering Contacts (Lines 115-126)

```typescript
// GroveDashboard.tsx:115-126
const filteredContacts = useMemo(() => {
  return contacts.filter((contact) => {
    // Search filter
    const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // Category/status filters
    if (activeFilter === "All") return true;
    if (activeFilter === "Dormant") return contact.status === "dormant" || contact.status === "wilted";
    if (activeFilter === "Priority") return contact.status === "attention" || contact.status === "wilted";
    return contact.category === activeFilter.toLowerCase();
  });
}, [contacts, searchQuery, activeFilter]);
```

**Key Points:**
- Filters contacts based on search query and active filter
- Uses `useMemo` to avoid recalculating on every render
- Only filtered contacts are used for graph generation

---

## 3. Graph Data Generation (Lines 128-211)

### Step 3.1: Normalize Metrics

```typescript
// Lines 137-161
// Normalize recency (0-1, where 0 = recent, 1 = old)
const recencies = filteredContacts.map(c => {
  if (c.recency !== undefined) return c.recency;
  if (c.daysSinceContact !== undefined) 
    return Math.min(1.0, c.daysSinceContact / RECENCY_NORMALIZATION_DAYS);
  return 0.5;
});

// Normalize frequency (0-1, where 0 = low, 1 = high)
const frequencies = filteredContacts.map(c => {
  if (c.frequency !== undefined) return c.frequency;
  if (c.metrics?.interactionFrequency !== undefined) {
    return Math.min(1.0, c.metrics.interactionFrequency / FREQUENCY_MAX_MSG_PER_DAY);
  }
  return 0;
});

// Normalize relative to max values
const maxRecency = Math.max(...recencies, 0.001);
const maxFrequency = Math.max(...frequencies, 0.001);

const normalizedRecencies = filteredContacts.map((c, i) => {
  return c.recency !== undefined 
    ? c.recency 
    : (maxRecency > 0 ? recencies[i] / maxRecency : 0.5);
});

const normalizedFrequencies = filteredContacts.map((c, i) => {
  return c.frequency !== undefined 
    ? c.frequency 
    : (maxFrequency > 0 ? frequencies[i] / maxFrequency : 0);
});
```

**Purpose:**
- Converts raw metrics (days since contact, messages/day) to normalized 0-1 values
- Ensures all contacts are on the same scale for visualization

---

### Step 3.2: Create Center Node ("You")

```typescript
// Lines 163-172
const centerNode = {
  id: 'you',
  name: 'You',
  isCenter: true,
  fx: CENTER_X,  // ← Fixed x position (500)
  fy: CENTER_Y,   // ← Fixed y position (400)
  x: CENTER_X,   // Initial x
  y: CENTER_Y,   // Initial y
};
```

**Key Properties:**
- `fx` and `fy`: **Fixed positions** - force simulation won't move this node
- `isCenter: true`: Used to identify center node in force calculations
- Position: `(500, 400)` from `GROVE_CONSTANTS`

---

### Step 3.3: Create Contact Nodes

```typescript
// Lines 174-197
const contactNodes = filteredContacts.map((contact, i) => {
  // Calculate angle for radial distribution
  const angleDegrees = (360 / totalContacts) * i;  // Evenly spaced around circle
  const angleRadians = (angleDegrees * Math.PI) / 180;
  
  // Get normalized metrics
  const recencyNormalized = normalizedRecencies[i];
  const frequencyNormalized = normalizedFrequencies[i];
  
  // Calculate distance from center based on recency
  // Recent contacts = closer (MIN_BRANCH_DISTANCE = 150px)
  // Old contacts = farther (MAX_BRANCH_DISTANCE = 200px)
  const distance = MIN_BRANCH_DISTANCE + recencyNormalized * (MAX_BRANCH_DISTANCE - MIN_BRANCH_DISTANCE);

  return {
    id: contact.id,
    name: contact.name,
    category: contact.category,
    status: contact.status,
    size: contact.size,
    recency: recencyNormalized,      // For link distance calculation
    frequency: frequencyNormalized,  // For branch thickness
    rotation: angleDegrees + 90,     // For leaf rotation
    // Initial position (will be adjusted by force simulation)
    x: CENTER_X + Math.cos(angleRadians) * distance,
    y: CENTER_Y + Math.sin(angleRadians) * distance,
    contactData: contact,  // Store full contact data for reference
  };
});
```

**Key Points:**
- **Radial distribution**: Contacts evenly spaced around 360° circle
- **Initial distance**: Based on recency (recent = close, old = far)
- **Initial position**: Calculated using trigonometry, but force simulation will adjust it
- **No `fx`/`fy`**: Contact nodes are NOT fixed, so they can move

---

### Step 3.4: Create Links (Branches)

```typescript
// Lines 199-205
const links = contactNodes.map((node) => ({
  source: 'you',        // Always from center
  target: node.id,      // To contact node
  recency: node.recency,        // For link distance calculation
  frequency: node.frequency,    // For branch thickness/opacity
}));
```

**Purpose:**
- Creates a link from "You" to each contact
- Stores `recency` and `frequency` for visual styling

---

### Step 3.5: Return Graph Data

```typescript
// Lines 207-210
return {
  nodes: [centerNode, ...contactNodes],  // Center first, then contacts
  links,
};
```

**Final Structure:**
```typescript
{
  nodes: [
    { id: 'you', isCenter: true, fx: 500, fy: 400, ... },
    { id: 'contact-1', recency: 0.3, frequency: 0.8, ... },
    { id: 'contact-2', recency: 0.7, frequency: 0.2, ... },
    ...
  ],
  links: [
    { source: 'you', target: 'contact-1', recency: 0.3, frequency: 0.8 },
    { source: 'you', target: 'contact-2', recency: 0.7, frequency: 0.2 },
    ...
  ]
}
```

---

## 4. Force Simulation Configuration (Lines 490-508)

### How "You" Stays Centered

```typescript
// Lines 490-508
d3Force={{
  // Link distance based on recency
  link: (link: any) => {
    const recency = link.recency || 0.5;
    const baseDistance = GROVE_CONSTANTS.MIN_BRANCH_DISTANCE;  // 150px
    const maxDistance = GROVE_CONSTANTS.MAX_BRANCH_DISTANCE;    // 200px
    return baseDistance + recency * (maxDistance - baseDistance);
  },
  
  // Node charge (repulsion)
  charge: (node: any) => {
    // Center node has NO charge (won't repel others)
    // Contact nodes have -300 charge (repel each other)
    return node.isCenter ? 0 : -300;
  },
  
  // Center force (pulls nodes toward center)
  center: {
    x: () => GROVE_CONSTANTS.CENTER_X,  // 500
    y: () => GROVE_CONSTANTS.CENTER_Y,  // 400
    strength: 0.05,  // Weak force to keep contacts near center
  },
}}
```

**How It Works:**
1. **`fx`/`fy` on center node**: The center node has `fx: 500, fy: 400`, which tells the force simulation to **keep it fixed** at that position
2. **No charge on center**: `charge: 0` means the center node doesn't repel other nodes
3. **Center force**: Weak force (0.05) pulls contact nodes toward the center, but doesn't override link distances
4. **Link distance**: Based on recency - recent contacts stay closer, old contacts stay farther

---

## 5. Rendering

### Canvas Rendering (Lines 472-513)

```typescript
<ForceGraph2D
  ref={forceGraphRef}
  graphData={graphData}  // ← Graph data from useMemo
  width={graphDimensions.width}
  height={graphDimensions.height}
  nodeCanvasObject={paintNode}  // Custom render for "You" node
  linkCanvasObject={paintLink}  // Custom render for branches
  onNodeClick={handleNodeClick}
  d3Force={{...}}  // Force configuration
/>
```

**What Happens:**
1. Force simulation runs and calculates positions
2. `paintNode` renders the watering can at center (lines 242-290)
3. `paintLink` renders branches with thickness based on frequency (lines 292-315)
4. Contact nodes are NOT rendered on canvas (handled by overlay)

### SVG Overlay (Lines 517-526)

```typescript
<LeafOverlay
  graphData={graphData}  // ← Same graph data
  nodes={graphData.nodes.filter((node: any) => !node.isCenter && node.id !== 'you')}
  onNodeClick={handleNodeClick}
  width={graphDimensions.width}
  height={graphDimensions.height}
/>
```

**What Happens:**
1. `LeafOverlay` reads node positions from `graphData.nodes` (which are mutated in place by force simulation)
2. Renders `GroveLeaf` components at those positions
3. Updates positions every 16ms (~60fps) to track force simulation

---

## 6. Adding New Contacts

### When a New Contact is Added:

1. **Backend**: New contact is created via API (e.g., after syncing iMessage)
2. **Frontend**: `contacts` state is updated (either via refetch or direct update)
3. **Graph Regeneration**: `graphData` useMemo recalculates automatically because it depends on `filteredContacts`
4. **Force Simulation**: New node is added to the graph, force simulation positions it
5. **Visual Update**: New leaf appears at the calculated position

**Example Flow:**
```typescript
// User syncs conversations
handleSyncConversations() {
  setIsSyncing(true);
  await apiClient.syncConversations(user.id);
  
  // Refetch contacts (includes new ones)
  const contactsResponse = await apiClient.getContacts(user.id);
  setContacts(contactsResponse.data.contacts);  // ← Triggers graphData recalculation
  setIsSyncing(false);
}
```

---

## 7. Key Constants

From `GROVE_CONSTANTS`:
- `CENTER_X: 500` - Center x position
- `CENTER_Y: 400` - Center y position
- `MIN_BRANCH_DISTANCE: 150` - Closest distance (recent contacts)
- `MAX_BRANCH_DISTANCE: 200` - Farthest distance (old contacts)
- `RECENCY_NORMALIZATION_DAYS: 90` - Days to normalize recency
- `FREQUENCY_MAX_MSG_PER_DAY: 5` - Max messages/day for normalization

---

## Summary

1. **Contacts fetched** → Stored in `contacts` state
2. **Contacts filtered** → `filteredContacts` based on search/filter
3. **Graph data generated** → `graphData` with center node (fixed) + contact nodes (movable)
4. **Force simulation** → Positions nodes based on recency/frequency
5. **Rendering** → Canvas for branches + center, SVG overlay for leaves
6. **New contacts** → Automatically added when `contacts` state updates

The center node stays fixed because:
- It has `fx` and `fy` properties (fixed position)
- It has `charge: 0` (no repulsion)
- Force simulation respects fixed positions

