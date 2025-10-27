# SIMT Design System - Health-Based Visual Language

## Core Design Philosophy

**Implicit > Explicit**: Instead of categorizing relationships by type (family/friends/work), we use natural visual metaphors that communicate relationship health intuitively.

## Visual Metaphors

### The Grove
Your relationships form a living grove, with you as the watering can at the center, nurturing connections.

### Health States

#### 🌿 Healthy (Green #10b981)
**Visual**: Full, vibrant green leaf
- Strong highlights showing vitality
- Full opacity
- Regular, natural sway animation
- **Meaning**: Thriving connection, regular communication

#### 🍂 Needs Attention (Orange #f59e0b)
**Visual**: Leaf with yellowing edges and dew drops
- Yellow patches on leaf edges (withering)
- Animated water droplet with ripple effect
- Slightly reduced highlight
- **Meaning**: Connection needs care, good time to reach out

#### 🌸 Dormant (Pink #ec4899)
**Visual**: Closed flower bud with sepals
- Teardrop-shaped closed bud
- Green sepals at base
- Gentle pulse animation
- **Meaning**: Relationship waiting to bloom, hasn't connected recently

#### 🍁 At Risk (Brown #78350f)
**Visual**: Withered leaf with brown spots
- Multiple brown spots across leaf
- Torn/curled edges
- Desaturated colors
- Reduced opacity
- **Meaning**: Connection at risk, needs urgent care

## Spatial Encoding

### Branch Characteristics
All branches flow from the central watering can to each leaf/bud:

1. **Thickness (1-6px)**: Relationship closeness
   - Thick = Close, frequent interaction
   - Thin = Casual, less frequent

2. **Length**: Recency of contact
   - Short (close to center) = Recent contact
   - Long (far from center) = Haven't spoken in a while

3. **Opacity (0.15-0.4)**: Connection strength
   - More opaque = Stronger bond
   - More transparent = Weaker connection

### Leaf/Bud Size
**Size range**: 25-60px
- Based on total interaction frequency
- Larger = More messages/interactions overall

## The Watering Can (Center)

Represents **you** as the gardener of your relationships:
- **Metal body** (#78716c): Solid, dependable
- **Visible water** (gradient #67e8f9 → #06b6d4): Your attention/care to give
- **Water shimmer**: Active, ready to nurture
- **Handle & spout**: Tools for reaching out
- **Glow effect**: Warmth and positive energy

## Animations

### Leaf Sway
- **Duration**: 3-5 seconds (randomized per leaf)
- **Amplitude**: ±3° rotation, ±1px vertical
- **Easing**: easeInOut
- **Purpose**: Natural, living feel

### Attention Dew Drop
- **Pulse**: Scale 1 → 1.3, opacity 0.6 → 0
- **Duration**: 2 seconds, infinite
- **Purpose**: Draw attention to leaves needing care

### Dormant Bud Pulse
- **Glow**: Scale 1 → 1.15, opacity 0.4 → 0.1
- **Duration**: 3 seconds, infinite
- **Purpose**: Gentle reminder of potential

### Hover Interactions
- **Scale**: 1.0 → 1.2
- **Duration**: 0.2 seconds
- **Purpose**: Clear interactive feedback

## Color Palette

### Primary Nature Colors
```css
--leaf-healthy: #10b981    /* Emerald green - vibrant life */
--leaf-attention: #f59e0b  /* Amber - autumn transition */
--leaf-dormant: #ec4899    /* Pink - flower buds */
--leaf-wilted: #78350f     /* Brown - dried/dead */
```

### Supporting Colors
```css
--water-primary: #06b6d4   /* Cyan - fresh water */
--water-secondary: #67e8f9 /* Light cyan - shimmer */
--dewdrop: #38bdf8         /* Sky blue - water droplet */
--grove-branch: #a8a29e    /* Warm gray - branches */
--grove-trunk: #78716c     /* Medium gray - watering can */
```

### Semantic Colors
```css
--primary: #0d9488         /* Teal - brand primary */
--secondary: #f0fdfa       /* Mint - subtle backgrounds */
--accent: #ccfbf1          /* Light teal - highlights */
```

## Typography

### Scale
- **H1**: 2xl (32px) - Modal titles, major headings
- **H2**: xl (24px) - Section headers
- **H3**: lg (20px) - Card headers
- **H4**: base (16px) - Subsections
- **Body**: base (16px) - Regular content
- **Small**: 0.875rem (14px) - Metadata
- **Tiny**: 0.75rem (12px) - Captions, legends

### Weight
- **Headings**: Medium (500)
- **Body**: Normal (400)
- **Emphasis**: Medium (500)

## Accessibility

### Reduced Motion
All animations respect `prefers-reduced-motion`:
- Sway animations disabled
- Hover scales reduced to 1.0
- Pulse effects disabled
- Transitions instant (duration: 0)

### Color Contrast
All health state colors meet WCAG AA standards:
- Green on light backgrounds: 4.5:1+
- Text on colored backgrounds: Uses white or dark overlays

### Interactive States
- Clear hover feedback (scale + shadow)
- Focus rings on all interactive elements
- Cursor changes to pointer on clickable items

## Layout Grid

### Grove Canvas
- **Center**: (500, 350) - Watering can position
- **Radius range**: 120-280px from center
- **Angular spread**: 
  - Family cluster: -70° 
  - Friends cluster: 0°
  - Work cluster: 70°
- Each cluster spreads ±35° × 5 positions

### Spacing
- **Label offset**: baseSize + 12px below leaf/bud
- **Branch origin**: Center of watering can
- **Branch target**: Center of each leaf/bud

## Interaction Patterns

### Click → Stats Modal
1. Click any leaf/bud
2. Modal slides in from center (scale 0.9 → 1.0)
3. Background darkens with blur
4. Shows relationship stats + AI prompts
5. Click outside or X to close

### Hover → Scale + Info
1. Hover over leaf/bud
2. Smooth scale to 1.2x
3. Opacity increases to 1.0
4. Name label remains readable

## Responsive Behavior

### Desktop (Default)
- Full grove visible
- All animations enabled
- Side panel with prompts

### Mobile Considerations
- Scale SVG to viewport
- Adjust center position
- Reduce animation complexity
- Stack panels vertically

## Design Tokens

All colors, sizes, and timing values are defined as CSS custom properties in `/styles/globals.css`, ensuring:
- Consistent theming
- Easy dark mode support
- Single source of truth
- Simple maintenance

## Future Enhancements

### Seasonal Variations
- Spring: Lighter greens, blooming flowers
- Summer: Deeper greens, full leaves
- Autumn: Orange/red healthy leaves
- Winter: Evergreen needles, frost effects

### Weather Effects
- Light rain when watering
- Sunshine rays for healthy relationships
- Morning dew on all leaves
- Gentle wind affecting sway

### Growth Animations
- Bud → Bloom transition when reconnecting with dormant contacts
- Wilted → Attention → Healthy progression over time
- New leaves sprouting for new contacts
- Seasonal leaf color changes
