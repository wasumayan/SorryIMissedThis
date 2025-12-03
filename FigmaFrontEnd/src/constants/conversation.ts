/**
 * Conversation View Constants
 * Centralized constants for conversation view
 */

export const CONVERSATION_CONSTANTS = {
  // Tone slider
  DEFAULT_TONE: 50, // 0-100 scale
  TONE_MAX: 100,
  TONE_STEP: 1,
  TONE_THRESHOLDS: {
    FORMAL: 33,
    FRIENDLY: 66,
  },
  
  // Message display
  MESSAGE_BUBBLE_MAX_WIDTH: '70%',
  RECIPROCITY_BARS: 5,
  
  // Textarea
  TEXTAREA_ROWS: 4,
  
  // Prompts
  DEFAULT_PROMPT_COUNT: 3,
  
  // Navigation
  NAVIGATE_BACK_DELAY: 2000, // ms
  
  // Time formatting thresholds
  TIME_THRESHOLDS: {
    DAYS: 7,
    WEEKS: 30,
    MONTHS: 365,
  },
};

