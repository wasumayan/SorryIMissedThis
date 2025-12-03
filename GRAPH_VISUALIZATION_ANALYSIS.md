# Graph Visualization Analysis

## Current Implementation

### Inputs (Contact Data Structure)
```typescript
interface Contact {
  id: string;
  name: string;
  category: 'family' | 'friends' | 'work';
  status: 'healthy' | 'attention' | 'dormant' | 'wilted';
  size: number;                    // 0-1 scale based on interaction frequency
  closeness: number;               // 0-1 (reciprocity)
  recency: number;                 // 0-1 (0 = recent, 1 = old)
  frequency?: number;              // 0-1 (0 = low, 1 = high) - avg messages/day
  daysSinceContact?: number;       // Raw days since last contact
  metrics: {
    totalMessages: number;
    reciprocity: number;
    interactionFrequency?: number;  // Messages per day in past 50 days
  };
}
```

### Layout Calculation (`layoutContacts` function)
**Location:** `GroveDashboard.tsx:109-181`

**Process:**
1. **Normalize recency** (0-1): How long since last contact
   - Recent contacts (low recency) = closer to center
   - Old contacts (high recency) = farther from center

2. **Normalize frequency** (0-1): How often you message
   - High frequency = thicker branch
   - Low frequency = thinner branch

3. **Calculate position:**
   ```typescript
   // Angle: Evenly distributed in 360° circle
   const angleDegrees = (360 / totalContacts) * i;
   const angleRadians = (angleDegrees * Math.PI) / 180;
   
   // Distance: Based on recency (150-200px range)
   const distance = MIN_BRANCH_DISTANCE + recencyNormalized * (MAX_BRANCH_DISTANCE - MIN_BRANCH_DISTANCE);
   
   // Position
   const x = CENTER_X + Math.cos(angleRadians) * distance;
   const y = CENTER_Y + Math.sin(angleRadians) * distance;
   ```

4. **Calculate visual properties:**
   - `lineThickness`: 2-8px based on frequency
   - `rotation`: Perpendicular to branch (angle + 90°)
   - `opacity`: 0.4-0.9 based on frequency

### Rendering
**Location:** `GroveDashboard.tsx:627-671`

**Structure:**
```tsx
<svg viewBox="...">
  {/* Center "You" node (watering can) */}
  <g transform="translate(500, 400)">
    {/* Watering can SVG illustration */}
  </g>
  
  {/* Branches + Leaves */}
  {layoutedContacts.map((contact) => (
    <g key={contact.id}>
      {/* Branch line */}
      <line
        x1={500} y1={400}  // Center
        x2={contact.x} y2={contact.y}  // Contact position
        strokeWidth={lineThickness}
        opacity={opacity}
      />
      
      {/* Leaf component */}
      <GroveLeaf
        x={contact.x}
        y={contact.y}
        rotation={contact.rotation}
        status={contact.status}
        size={contact.size}
        onClick={handleLeafClick}
      />
    </g>
  ))}
</svg>
```

## Issues with Current Implementation

1. **Manual SVG management**: Complex zoom/pan logic, viewBox calculations
2. **No physics simulation**: Static radial layout, no dynamic positioning
3. **Performance**: Re-renders entire SVG on every state change
4. **Limited interactivity**: Manual click detection, no hover effects
5. **No collision detection**: Contacts can overlap
6. **Hard to debug**: Complex coordinate transformations

## Recommended Solution: Use `react-force-graph`

Based on the [Plotly network graphs example](https://plotly.com/python/network-graphs/), but adapted for React/TypeScript, we should use **`react-force-graph`** which provides:

- ✅ Force-directed layout (automatic positioning)
- ✅ Custom node rendering (your GroveLeaf component)
- ✅ Custom link rendering (your branches)
- ✅ Built-in zoom/pan
- ✅ Performance optimizations
- ✅ Interactive features (hover, click, drag)
- ✅ Collision detection
- ✅ Physics simulation

### Installation
```bash
npm install react-force-graph
```

### Example Implementation
```typescript
import ForceGraph2D from 'react-force-graph-2d';

// Convert contacts to graph data
const graphData = {
  nodes: [
    { id: 'you', name: 'You', x: 500, y: 400, fx: 500, fy: 400 }, // Fixed center
    ...contacts.map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      recency: c.recency,
      frequency: c.frequency,
      size: c.size,
    }))
  ],
  links: contacts.map(c => ({
    source: 'you',
    target: c.id,
    recency: c.recency,
    frequency: c.frequency,
  }))
};

<ForceGraph2D
  graphData={graphData}
  nodeCanvasObject={(node, ctx) => {
    // Custom render GroveLeaf
    if (node.id === 'you') {
      // Render watering can
    } else {
      // Render leaf
    }
  }}
  linkCanvasObject={(link, ctx) => {
    // Custom render branch
  }}
  onNodeClick={handleLeafClick}
  zoom={zoomLevel}
  onZoomEnd={setZoomLevel}
/>
```

