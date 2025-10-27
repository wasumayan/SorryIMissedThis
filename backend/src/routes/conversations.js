const express = require('express');
const { body, validationResult } = require('express-validator');
const Conversation = require('../models/Conversation');
const Contact = require('../models/Contact');

const router = express.Router();

// @route   GET /api/conversations
// @desc    Get all conversations for user
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { contactId, platform, limit = 20, offset = 0 } = req.query;
    
    // Build filter object
    const filter = { userId: req.user.id };
    
    if (contactId) {
      filter.contactId = contactId;
    }
    
    if (platform) {
      filter.platform = platform;
    }

    const conversations = await Conversation.find(filter)
      .populate('contactId', 'name category status')
      .sort({ lastMessageAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await Conversation.countDocuments(filter);

    res.json({
      success: true,
      data: {
        conversations,
        total,
        hasMore: offset + conversations.length < total,
      },
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations',
    });
  }
});

// @route   GET /api/conversations/:id
// @desc    Get single conversation
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).populate('contactId', 'name category status');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    res.json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation',
    });
  }
});

// @route   POST /api/conversations
// @desc    Create new conversation
// @access  Private
router.post('/', [
  body('contactId').isMongoId().withMessage('Invalid contact ID'),
  body('platform').isIn(['whatsapp', 'telegram', 'sms', 'email']).withMessage('Invalid platform'),
  body('platformConversationId').notEmpty().withMessage('Platform conversation ID is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { contactId, platform, platformConversationId, messages = [] } = req.body;

    // Check if conversation already exists
    const existingConversation = await Conversation.findOne({
      userId: req.user.id,
      contactId,
      platform,
      platformConversationId,
    });

    if (existingConversation) {
      return res.status(400).json({
        success: false,
        error: 'Conversation already exists',
      });
    }

    const conversation = new Conversation({
      userId: req.user.id,
      contactId,
      platform,
      platformConversationId,
      messages,
    });

    // Calculate metrics
    conversation.calculateMetrics();

    await conversation.save();

    res.status(201).json({
      success: true,
      message: 'Conversation created successfully',
      data: { conversation },
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create conversation',
    });
  }
});

// @route   PUT /api/conversations/:id/messages
// @desc    Add messages to conversation
// @access  Private
router.put('/:id/messages', [
  body('messages').isArray().withMessage('Messages must be an array'),
  body('messages.*.id').notEmpty().withMessage('Message ID is required'),
  body('messages.*.sender').isIn(['user', 'contact']).withMessage('Invalid sender'),
  body('messages.*.text').notEmpty().withMessage('Message text is required'),
  body('messages.*.timestamp').isISO8601().withMessage('Invalid timestamp'),
  body('messages.*.platform').isIn(['whatsapp', 'telegram', 'sms', 'email']).withMessage('Invalid platform'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    const { messages } = req.body;

    // Add new messages
    conversation.messages.push(...messages);
    conversation.lastMessageAt = new Date();

    // Recalculate metrics
    conversation.calculateMetrics();

    await conversation.save();

    res.json({
      success: true,
      message: 'Messages added successfully',
      data: { conversation },
    });
  } catch (error) {
    console.error('Add messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add messages',
    });
  }
});

// @route   GET /api/conversations/:id/summary
// @desc    Get conversation summary
// @access  Private
router.get('/:id/summary', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    const summary = conversation.getSummary();

    res.json({
      success: true,
      data: { summary },
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation summary',
    });
  }
});

// @route   DELETE /api/conversations/:id
// @desc    Delete conversation
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    res.json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete conversation',
    });
  }
});

module.exports = router;

