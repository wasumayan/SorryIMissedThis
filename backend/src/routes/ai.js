const express = require('express');
const { body, validationResult } = require('express-validator');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const { analyzeConversation, generatePrompts } = require('../services/aiService');

const router = express.Router();

// @route   POST /api/ai/analyze-conversation
// @desc    Analyze a conversation and generate insights
// @access  Private
router.post('/analyze-conversation', [
  body('conversationId').isMongoId().withMessage('Invalid conversation ID'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { conversationId } = req.body;

    // Get conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.user.id,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    // Analyze conversation with AI
    const analysis = await analyzeConversation(conversation);

    // Update conversation with analysis
    conversation.aiAnalysis = analysis;
    conversation.aiAnalysis.lastAnalyzed = new Date();
    await conversation.save();

    res.json({
      success: true,
      data: { analysis },
    });
  } catch (error) {
    console.error('Analyze conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze conversation',
    });
  }
});

// @route   POST /api/ai/generate-prompts
// @desc    Generate AI prompts for a contact
// @access  Private
router.post('/generate-prompts', [
  body('contactId').isMongoId().withMessage('Invalid contact ID'),
  body('context').optional().isString().withMessage('Context must be a string'),
  body('tone').optional().isIn(['formal', 'friendly', 'playful']).withMessage('Invalid tone'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { contactId, context, tone = 'friendly' } = req.body;

    // Get contact
    const contact = await Contact.findOne({
      _id: contactId,
      userId: req.user.id,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }

    // Get recent conversations for context
    const recentConversations = await Conversation.find({
      contactId,
      userId: req.user.id,
    })
      .sort({ lastMessageAt: -1 })
      .limit(3)
      .select('aiAnalysis messages lastMessageAt');

    // Generate prompts
    const prompts = await generatePrompts(contact, recentConversations, {
      context,
      tone,
    });

    res.json({
      success: true,
      data: { prompts },
    });
  } catch (error) {
    console.error('Generate prompts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate prompts',
    });
  }
});

// @route   POST /api/ai/analyze-relationship
// @desc    Analyze overall relationship health and provide insights
// @access  Private
router.post('/analyze-relationship', [
  body('contactId').isMongoId().withMessage('Invalid contact ID'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { contactId } = req.body;

    // Get contact and recent conversations
    const contact = await Contact.findOne({
      _id: contactId,
      userId: req.user.id,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }

    const conversations = await Conversation.find({
      contactId,
      userId: req.user.id,
    })
      .sort({ lastMessageAt: -1 })
      .limit(10);

    // Analyze relationship patterns
    const analysis = {
      healthScore: contact.calculateHealthScore(),
      currentStatus: contact.status,
      insights: contact.getInsights(),
      communicationPatterns: {
        averageResponseTime: contact.metrics.averageResponseTime,
        reciprocity: contact.metrics.reciprocity,
        frequency: contact.metrics.interactionFrequency,
      },
      recentTrends: {
        messageCount: conversations.reduce((sum, conv) => sum + conv.metrics.totalMessages, 0),
        sentimentTrend: conversations.map(conv => conv.aiAnalysis?.sentiment?.overall).filter(Boolean),
        topicDiversity: [...new Set(conversations.flatMap(conv => 
          conv.aiAnalysis?.topics?.map(t => t.topic) || []
        ))],
      },
      recommendations: [],
    };

    // Generate recommendations based on analysis
    if (contact.status === 'wilted') {
      analysis.recommendations.push({
        type: 'urgent',
        message: 'This relationship needs immediate attention',
        action: 'Reach out with a thoughtful message',
      });
    } else if (contact.status === 'dormant') {
      analysis.recommendations.push({
        type: 'reconnect',
        message: 'Time to rekindle this connection',
        action: 'Send a warm, personal message',
      });
    } else if (contact.metrics.reciprocity < 0.3) {
      analysis.recommendations.push({
        type: 'balance',
        message: 'Consider giving them space to respond',
        action: 'Wait for their response before reaching out again',
      });
    }

    res.json({
      success: true,
      data: { analysis },
    });
  } catch (error) {
    console.error('Analyze relationship error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze relationship',
    });
  }
});

// @route   GET /api/ai/suggestions/daily
// @desc    Get daily AI suggestions for relationship maintenance
// @access  Private
router.get('/suggestions/daily', async (req, res) => {
  try {
    // Get contacts that need attention
    const attentionContacts = await Contact.find({
      userId: req.user.id,
      status: { $in: ['attention', 'wilted'] },
    })
      .sort({ 'metrics.lastContact': 1 })
      .limit(5);

    // Get dormant contacts
    const dormantContacts = await Contact.find({
      userId: req.user.id,
      status: 'dormant',
    })
      .sort({ 'metrics.lastContact': 1 })
      .limit(3);

    const suggestions = [];

    // Generate suggestions for attention contacts
    for (const contact of attentionContacts) {
      const recentConversations = await Conversation.find({
        contactId: contact._id,
        userId: req.user.id,
      })
        .sort({ lastMessageAt: -1 })
        .limit(1);

      const prompts = await generatePrompts(contact, recentConversations, {
        tone: req.user.preferences.ai.promptStyle,
      });

      suggestions.push({
        contact: {
          id: contact._id,
          name: contact.name,
          status: contact.status,
        },
        priority: contact.status === 'wilted' ? 'high' : 'medium',
        suggestion: prompts[0] || {
          text: `Check in with ${contact.name} - they might appreciate hearing from you`,
          reason: 'Relationship needs attention',
        },
        lastContact: contact.metrics.lastContact,
      });
    }

    // Generate suggestions for dormant contacts
    for (const contact of dormantContacts) {
      suggestions.push({
        contact: {
          id: contact._id,
          name: contact.name,
          status: contact.status,
        },
        priority: 'low',
        suggestion: {
          text: `Reconnect with ${contact.name} - it's been a while since you last spoke`,
          reason: 'Dormant relationship',
        },
        lastContact: contact.metrics.lastContact,
      });
    }

    res.json({
      success: true,
      data: { suggestions },
    });
  } catch (error) {
    console.error('Get daily suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get daily suggestions',
    });
  }
});

module.exports = router;

