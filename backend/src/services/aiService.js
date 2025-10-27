const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze a conversation using AI
 * @param {Object} conversation - Conversation object
 * @returns {Object} Analysis results
 */
const analyzeConversation = async (conversation) => {
  try {
    // Prepare conversation text for analysis
    const messages = conversation.messages.map(msg => ({
      sender: msg.sender,
      text: msg.text,
      timestamp: msg.timestamp,
    }));

    const conversationText = messages.map(msg => 
      `${msg.sender}: ${msg.text}`
    ).join('\n');

    // Create analysis prompt
    const analysisPrompt = `
Analyze this conversation and provide insights:

${conversationText}

Please provide:
1. A brief summary of the conversation
2. Overall sentiment (positive, neutral, negative)
3. Key topics discussed
4. Important moments or events mentioned
5. Follow-up suggestions based on the conversation
6. Communication patterns observed

Format your response as JSON with these fields:
- summary: string
- sentiment: { overall: string, userSentiment: string, contactSentiment: string }
- topics: [{ topic: string, confidence: number, mentions: number }]
- keyMoments: [{ timestamp: string, description: string, importance: string }]
- followUpSuggestions: [{ suggestion: string, reason: string, priority: string, timing: string }]
- communicationPatterns: { userStyle: string, contactStyle: string, reciprocity: number }
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that analyzes conversations to help people maintain better relationships. Provide thoughtful, empathetic analysis that helps users understand their communication patterns and suggests meaningful ways to connect with others."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const analysisText = response.choices[0].message.content;
    
    // Parse JSON response
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback analysis
      analysis = {
        summary: "Conversation analysis completed",
        sentiment: {
          overall: "neutral",
          userSentiment: "neutral",
          contactSentiment: "neutral"
        },
        topics: [],
        keyMoments: [],
        followUpSuggestions: [],
        communicationPatterns: {
          userStyle: "balanced",
          contactStyle: "balanced",
          reciprocity: 0.5
        }
      };
    }

    return analysis;
  } catch (error) {
    console.error('AI analysis error:', error);
    throw new Error('Failed to analyze conversation');
  }
};

/**
 * Generate AI prompts for contacting someone
 * @param {Object} contact - Contact object
 * @param {Array} recentConversations - Recent conversations
 * @param {Object} options - Generation options
 * @returns {Array} Generated prompts
 */
const generatePrompts = async (contact, recentConversations, options = {}) => {
  try {
    const { context, tone = 'friendly' } = options;
    
    // Prepare context from recent conversations
    let conversationContext = '';
    if (recentConversations.length > 0) {
      const lastConversation = recentConversations[0];
      const recentMessages = lastConversation.messages.slice(-5); // Last 5 messages
      conversationContext = recentMessages.map(msg => 
        `${msg.sender}: ${msg.text}`
      ).join('\n');
    }

    // Create prompt generation request
    const promptRequest = `
Generate 3 thoughtful message prompts for reaching out to ${contact.name}.

Contact Information:
- Name: ${contact.name}
- Category: ${contact.category}
- Last Contact: ${contact.metrics.lastContact}
- Relationship Status: ${contact.status}
- Reciprocity Score: ${contact.metrics.reciprocity}

Recent Conversation Context:
${conversationContext || 'No recent conversation context'}

Additional Context:
${context || 'No additional context provided'}

Requirements:
- Tone: ${tone}
- Make messages personal and thoughtful
- Reference recent conversations if available
- Consider the relationship status
- Provide different approaches (casual, caring, specific)
- Each message should be 1-3 sentences
- Include the reason why this prompt is suggested

Format as JSON array:
[
  {
    "text": "message text here",
    "reason": "why this prompt is suggested",
    "tone": "message tone",
    "priority": "high/medium/low"
  }
]
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a relationship coach AI that helps people maintain meaningful connections. Generate thoughtful, personalized message prompts that feel natural and considerate. Always prioritize genuine care and understanding in your suggestions."
        },
        {
          role: "user",
          content: promptRequest
        }
      ],
      temperature: 0.8,
      max_tokens: 1000,
    });

    const promptsText = response.choices[0].message.content;
    
    // Parse JSON response
    let prompts;
    try {
      prompts = JSON.parse(promptsText);
    } catch (parseError) {
      console.error('Failed to parse prompts response:', parseError);
      // Fallback prompts
      prompts = [
        {
          text: `Hey ${contact.name}! I've been thinking about you. How have you been?`,
          reason: 'Simple check-in to reconnect',
          tone: tone,
          priority: 'medium'
        },
        {
          text: `Hi ${contact.name}, hope you're doing well. I'd love to catch up soon!`,
          reason: 'Warm reconnection attempt',
          tone: tone,
          priority: 'medium'
        },
        {
          text: `Hello ${contact.name}! Just wanted to say hi and see how things are going.`,
          reason: 'Friendly outreach',
          tone: tone,
          priority: 'low'
        }
      ];
    }

    return prompts;
  } catch (error) {
    console.error('Generate prompts error:', error);
    throw new Error('Failed to generate prompts');
  }
};

/**
 * Analyze relationship patterns and suggest improvements
 * @param {Object} contact - Contact object
 * @param {Array} conversations - All conversations with this contact
 * @returns {Object} Relationship analysis
 */
const analyzeRelationshipPatterns = async (contact, conversations) => {
  try {
    // Prepare conversation data for analysis
    const conversationData = conversations.map(conv => ({
      messages: conv.messages.length,
      duration: conv.lastMessageAt - conv.startedAt,
      sentiment: conv.aiAnalysis?.sentiment?.overall || 'neutral',
      topics: conv.aiAnalysis?.topics || [],
    }));

    const analysisPrompt = `
Analyze the relationship patterns with ${contact.name} based on this data:

Contact: ${contact.name} (${contact.category})
Status: ${contact.status}
Total Messages: ${contact.metrics.totalMessages}
Reciprocity: ${contact.metrics.reciprocity}
Last Contact: ${contact.metrics.lastContact}

Conversation Data:
${JSON.stringify(conversationData, null, 2)}

Provide insights on:
1. Communication patterns
2. Relationship health trends
3. Optimal contact frequency
4. Communication style preferences
5. Suggestions for improvement

Format as JSON:
{
  "patterns": {
    "communicationFrequency": "string",
    "responsePatterns": "string",
    "topicPreferences": ["string"],
    "optimalTiming": "string"
  },
  "healthTrends": {
    "direction": "improving/declining/stable",
    "keyFactors": ["string"],
    "riskFactors": ["string"]
  },
  "recommendations": [
    {
      "type": "string",
      "description": "string",
      "priority": "high/medium/low"
    }
  ]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a relationship analyst AI that helps people understand and improve their communication patterns. Provide insightful, actionable recommendations based on communication data."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      temperature: 0.6,
      max_tokens: 1200,
    });

    const analysisText = response.choices[0].message.content;
    
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.error('Failed to parse relationship analysis:', parseError);
      analysis = {
        patterns: {
          communicationFrequency: "moderate",
          responsePatterns: "balanced",
          topicPreferences: [],
          optimalTiming: "flexible"
        },
        healthTrends: {
          direction: "stable",
          keyFactors: [],
          riskFactors: []
        },
        recommendations: []
      };
    }

    return analysis;
  } catch (error) {
    console.error('Relationship analysis error:', error);
    throw new Error('Failed to analyze relationship patterns');
  }
};

module.exports = {
  analyzeConversation,
  generatePrompts,
  analyzeRelationshipPatterns,
};

