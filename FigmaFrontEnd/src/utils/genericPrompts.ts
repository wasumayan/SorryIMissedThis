/**
 * Generic Prompts System
 * Provides general conversation starters aligned with the user's tone but with no context of the conversation
 */

export interface GenericPrompt {
  text: string;
  category: 'greeting' | 'check_in' | 'sharing' | 'question' | 'planning';
}

export const GENERIC_PROMPTS: GenericPrompt[] = [
  // Greetings
  { text: "Hey! How's it going?", category: 'greeting' },
  { text: "Hi! Hope you're doing well!", category: 'greeting' },
  { text: "Hey there! What's new?", category: 'greeting' },

  // Check-ins
  { text: "How have you been?", category: 'check_in' },
  { text: "How's your day going?", category: 'check_in' },
  { text: "Hope you're having a good week!", category: 'check_in' },
  { text: "How are things on your end?", category: 'check_in' },
  { text: "How's everything going?", category: 'check_in' },

  // Sharing
  { text: "I was thinking about you today!", category: 'sharing' },
  { text: "Just wanted to say hi and see how you're doing", category: 'sharing' },
  { text: "Haven't talked in a while, wanted to reach out!", category: 'sharing' },
  { text: "Saw something that reminded me of you", category: 'sharing' },

  // Questions
  { text: "What have you been up to lately?", category: 'question' },
  { text: "Anything exciting happening?", category: 'question' },
  { text: "How's work/school been?", category: 'question' },
  { text: "What's been keeping you busy?", category: 'question' },
  { text: "Got any plans for the weekend?", category: 'question' },
  { text: "Read any good books lately?", category: 'question' },
  { text: "Watched anything good recently?", category: 'question' },

  // Planning
  { text: "Want to catch up sometime soon?", category: 'planning' },
  { text: "We should grab coffee sometime!", category: 'planning' },
  { text: "Would love to catch up when you're free", category: 'planning' },
  { text: "Let's hang out soon!", category: 'planning' },
];

/**
 * Get a random generic prompt
 * @param exclude - Optional array of prompt texts to exclude
 * @returns A random generic prompt
 */
export function getRandomGenericPrompt(exclude: string[] = []): GenericPrompt {
  const availablePrompts = GENERIC_PROMPTS.filter(p => !exclude.includes(p.text));
  const randomIndex = Math.floor(Math.random() * availablePrompts.length);
  return availablePrompts[randomIndex] || GENERIC_PROMPTS[0];
}

/**
 * Get multiple random generic prompts
 * @param count - Number of prompts to get
 * @returns Array of random generic prompts (no duplicates)
 */
export function getRandomGenericPrompts(count: number = 3): GenericPrompt[] {
  const shuffled = [...GENERIC_PROMPTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, GENERIC_PROMPTS.length));
}

/**
 * Get generic prompts by category
 * @param category - The category to filter by
 * @param count - Number of prompts to get (optional)
 * @returns Array of generic prompts from that category
 */
export function getGenericPromptsByCategory(
  category: GenericPrompt['category'],
  count?: number
): GenericPrompt[] {
  const categoryPrompts = GENERIC_PROMPTS.filter(p => p.category === category);
  if (count) {
    return categoryPrompts.slice(0, count);
  }
  return categoryPrompts;
}
