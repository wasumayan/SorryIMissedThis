/**
 * Analytics Constants
 * Centralized constants for analytics visualization
 */

export const ANALYTICS_CONSTANTS = {
  SVG_SIZE: 400,
  SVG_CENTER: 200,
  
  // Growth rings
  RING_START_RADIUS: 60,
  RING_INCREMENT: 40,
  RING_STROKE_WIDTH: 25,
  CENTER_CIRCLE_RADIUS: 35,
  RING_OPACITY_MIN: 0.7,
  RING_OPACITY_MAX: 1.0,
  
  // Display limits
  MAX_REVIVED_DISPLAYED: 2,
  MAX_TRENDS_DISPLAYED: 2,
  
  // Colors
  TOPIC_COLORS: [
    '#0d9488', '#10b981', '#3b82f6', '#8b5cf6',
    '#06b6d4', '#f59e0b', '#ec4899'
  ],
  
  CARD_BORDER_COLORS: {
    MESSAGES: '#06b6d420',
    RESPONSE_TIME: '#10b98120',
    CONTACTS: '#8b5cf620',
  },
  
  GRADIENT_COLORS: {
    RESPONSE_TIME: {
      FROM: '#10b981',
      TO: '#10b981',
    },
    CONTACTS: {
      FROM: '#8b5cf6',
      TO: '#8b5cf6',
    },
  },
  
  TREND_COLORS: {
    REVIVED: '#10b981',
    HEALTH: '#fbbf24',
    COMMUNICATION: 'primary', // Use theme color
  },
};

