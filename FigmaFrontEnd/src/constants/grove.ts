/**
 * Grove Dashboard Constants
 * Centralized constants for grove visualization to avoid hardcoded values
 */

export const GROVE_CONSTANTS = {
  // Center position (single source of truth)
  CENTER_X: 500,
  CENTER_Y: 400,
  
  // SVG dimensions
  SVG_WIDTH: 1000,
  SVG_HEIGHT: 800, // Fixed: was inconsistent (700 vs 800)
  
  // Branch layout
  MIN_BRANCH_DISTANCE: 120, // Closest (recent contacts)
  MAX_BRANCH_DISTANCE: 250, // Farthest (old contacts)
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
  
  // Watering can (center icon) dimensions
  WATERING_CAN: {
    GLOW_RADIUS: 60,
    CAN_BODY_RX: 28,
    CAN_BODY_RY: 30,
    CAN_BODY_CY: 5,
    WATER_RX: 22,
    WATER_RY: 20,
    WATER_CY: 10,
    SHIMMER_CX: -5,
    SHIMMER_CY: 5,
    SHIMMER_RX: 12,
    SHIMMER_RY: 8,
    RIM_CY: -23,
    RIM_RX: 20,
    RIM_RY: 6,
    RIM_CY_TOP: -24,
    RIM_RY_TOP: 5,
    HANDLE_STROKE_WIDTH: 4,
    SPOUT_HOLES: [
      { cx: -38, cy: -17, r: 1.5 },
      { cx: -40, cy: -14, r: 1.5 },
      { cx: -42, cy: -16, r: 1.5 },
    ],
  },
  
  // Label positions (relative to center)
  LABEL_OFFSETS: {
    YOU_LABEL_Y: 55, // Below center (400 + 55 = 455)
    LOADING_TEXT_Y: -80, // Above center (400 - 80 = 320)
    LOADING_CIRCLE_Y: -50, // Above center (400 - 50 = 350)
    EMPTY_TEXT_Y: -90, // Above center (400 - 90 = 310)
    EMPTY_SUBTITLE_Y: -60, // Above center (400 - 60 = 340)
  },
  
  // Colors
  COLORS: {
    HEALTHY: '#10b981',
    ATTENTION: '#f59e0b',
    DORMANT: '#ec4899',
    WILTED: '#78350f',
    BRANCH: '#78350f',
    WATER_GLOW_START: '#06b6d4',
    WATER_GLOW_END: '#06b6d4',
    WATER_GRADIENT_START: '#67e8f9',
    WATER_GRADIENT_END: '#06b6d4',
    CAN_BODY: '#78716c',
    CAN_RIM: '#57534e',
    PRIORITY_HIGH: '#f59e0b',
    PRIORITY_MEDIUM: '#06b6d4',
    PRIORITY_LOW: '#10b981',
  },
  
  // Opacity ranges
  BRANCH_OPACITY: {
    MIN: 0.4,
    MAX: 0.9,
  },
  
  // Layout
  RIGHT_PANEL_WIDTH: 320, // w-80 = 20rem = 320px
  MAX_SUGGESTIONS_DISPLAYED: 3,
  MAX_DORMANT_DISPLAYED: 3,
  
  // Filters
  FILTERS: ['All', 'Family', 'Friends', 'Work', 'Dormant', 'Priority'] as const,
};

