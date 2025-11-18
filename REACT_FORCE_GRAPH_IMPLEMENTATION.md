# React Force Graph Implementation

## Overview

The grove visualization has been re-implemented using `react-force-graph-2d` instead of manual SVG rendering. This provides:
- ✅ Automatic physics-based positioning
- ✅ Built-in zoom/pan functionality
- ✅ Better performance with canvas rendering
- ✅ Preserved styling (GroveLeaf components via SVG overlay)

## Architecture

### Components

1. **ForceGraph2D** (Canvas-based)
   - Renders branches (links) and center "You" node
   - Handles physics simulation and positioning
   - Provides zoom/pan interactions

2. **LeafOverlay** (SVG overlay)
   - Renders GroveLeaf components on top of canvas
   - Syncs positions with force graph in real-time (~60fps)
   - Preserves all GroveLeaf animations and styling

### Data Flow

```
Contacts (from API)
  ↓
graphData (nodes + links)
  ↓
ForceGraph2D (canvas rendering)
  ├─→ Branches (paintLink)
  └─→ Center node "You" (paintNode)
  ↓
LeafOverlay (SVG overlay)
  └─→ GroveLeaf components (synced positions)
```

## Inputs

**Contact Data Structure:**
```typescript
interface Contact {
  id: string;
  name: string;
  recency: number;        // 0-1 (0 = recent, 1 = old)
  frequency: number;     // 0-1 (0 = low, 1 = high)
  status: 'healthy' | 'attention' | 'dormant' | 'wilted';
  size: number;          // 0-1 scale
  category: 'family' | 'friends' | 'work';
  // ... other fields
}
```

## Graph Data Conversion

**Location:** `GroveDashboard.tsx:103-186`

**Process:**
1. Normalize recency/frequency values (0-1)
2. Create center node ("You") with fixed position (`fx`, `fy`)
3. Create contact nodes with initial radial positions
4. Create links from center to each contact with recency/frequency metadata

**Output:**
```typescript
{
  nodes: [
    { id: 'you', isCenter: true, fx: 500, fy: 400, ... },
    { id: 'contact-1', recency: 0.3, frequency: 0.8, ... },
    ...
  ],
  links: [
    { source: 'you', target: 'contact-1', recency: 0.3, frequency: 0.8 },
    ...
  ]
}
```

## Force Simulation Configuration

**Location:** `GroveDashboard.tsx:463-480`

**Settings:**
- **Link distance**: Based on recency (150-200px range)
- **Charge**: -300 (repulsion between contact nodes, 0 for center)
- **Center force**: Weak (0.05) to keep contacts near center
- **Fixed center**: Center node uses `fx`, `fy` to stay fixed

## Custom Rendering

### Branches (Links)
**Function:** `paintLink` (lines 267-288)
- Thickness: Based on frequency (2-8px)
- Opacity: Based on frequency (0.4-0.9)
- Color: Brown (#78350f)

### Center Node ("You")
**Function:** `paintNode` (lines 217-264)
- Renders watering can illustration
- Fixed at center (500, 400)
- Includes glow effect and "You" label

### Contact Nodes (Leaves)
**Component:** `LeafOverlay.tsx`
- Renders GroveLeaf SVG components
- Syncs positions from force graph every 16ms (~60fps)
- Preserves all animations and styling

## Key Features Preserved

✅ **Visual Properties:**
- Branch length = recency (recent = close, old = far)
- Branch thickness = frequency (active = thick, inactive = thin)
- Leaf color = status (healthy, attention, dormant, wilted)
- Leaf size = interaction frequency

✅ **Interactions:**
- Click on leaves → Navigate to conversation
- Zoom controls (buttons + mouse wheel)
- Pan/drag
- Hover effects (via GroveLeaf)

✅ **Styling:**
- Watering can illustration at center
- GroveLeaf animations (sway, bloom)
- Branch opacity and colors
- All original visual design

## Benefits Over Manual SVG

1. **Automatic positioning**: Physics simulation handles layout
2. **Better performance**: Canvas rendering is faster than SVG for many elements
3. **Built-in interactions**: Zoom/pan handled by library
4. **Collision detection**: Nodes automatically avoid overlapping
5. **Smoother animations**: Force simulation provides natural movement
6. **Less code**: No manual viewBox/zoom calculations

## Files Modified

- `FigmaFrontEnd/src/components/GroveDashboard.tsx` - Main implementation
- `FigmaFrontEnd/src/components/LeafOverlay.tsx` - New component for SVG overlay
- `FigmaFrontEnd/package.json` - Added `react-force-graph` dependency

## Testing

To verify the implementation works:
1. Check that contacts appear around the center "You" node
2. Verify branch thickness varies with frequency
3. Verify branch length varies with recency
4. Test leaf clicks navigate to conversation view
5. Test zoom/pan controls work
6. Verify GroveLeaf animations still work

