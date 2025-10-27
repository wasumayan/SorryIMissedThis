const express = require('express');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');

const router = express.Router();

// @route   GET /api/analytics/overview
// @desc    Get analytics overview
// @access  Private
router.get('/overview', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get contact statistics
    const contactStats = await Contact.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          healthy: { $sum: { $cond: [{ $eq: ['$status', 'healthy'] }, 1, 0] } },
          attention: { $sum: { $cond: [{ $eq: ['$status', 'attention'] }, 1, 0] } },
          dormant: { $sum: { $cond: [{ $eq: ['$status', 'dormant'] }, 1, 0] } },
          wilted: { $sum: { $cond: [{ $eq: ['$status', 'wilted'] }, 1, 0] } },
          avgReciprocity: { $avg: '$metrics.reciprocity' },
        },
      },
    ]);

    // Get conversation statistics
    const conversationStats = await Conversation.aggregate([
      { 
        $match: { 
          userId: req.user._id,
          lastMessageAt: { $gte: startDate }
        } 
      },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: '$metrics.totalMessages' },
          totalConversations: { $sum: 1 },
          avgMessagesPerConversation: { $avg: '$metrics.totalMessages' },
          avgResponseTime: { $avg: '$metrics.responseTime.average' },
        },
      },
    ]);

    // Get weekly activity data
    const weeklyActivity = await Conversation.aggregate([
      { 
        $match: { 
          userId: req.user._id,
          lastMessageAt: { $gte: startDate }
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: '$lastMessageAt' },
            week: { $week: '$lastMessageAt' },
          },
          messages: { $sum: '$metrics.totalMessages' },
          conversations: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.week': 1 } },
      { $limit: 12 }, // Last 12 weeks
    ]);

    // Get topic diversity
    const topicDiversity = await Conversation.aggregate([
      { 
        $match: { 
          userId: req.user._id,
          lastMessageAt: { $gte: startDate },
          'aiAnalysis.topics': { $exists: true }
        } 
      },
      { $unwind: '$aiAnalysis.topics' },
      {
        $group: {
          _id: '$aiAnalysis.topics.topic',
          count: { $sum: 1 },
          confidence: { $avg: '$aiAnalysis.topics.confidence' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Get relationship health trends
    const healthTrends = await Contact.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgReciprocity: { $avg: '$metrics.reciprocity' },
          avgLastContact: { $avg: { $subtract: [new Date(), '$metrics.lastContact'] } },
        },
      },
    ]);

    const overview = {
      contacts: contactStats[0] || {
        total: 0,
        healthy: 0,
        attention: 0,
        dormant: 0,
        wilted: 0,
        avgReciprocity: 0,
      },
      conversations: conversationStats[0] || {
        totalMessages: 0,
        totalConversations: 0,
        avgMessagesPerConversation: 0,
        avgResponseTime: 0,
      },
      weeklyActivity,
      topicDiversity,
      healthTrends,
      period,
    };

    res.json({
      success: true,
      data: { overview },
    });
  } catch (error) {
    console.error('Get analytics overview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics overview',
    });
  }
});

// @route   GET /api/analytics/contacts/:id
// @desc    Get analytics for specific contact
// @access  Private
router.get('/contacts/:id', async (req, res) => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }

    // Get conversation history
    const conversations = await Conversation.find({
      contactId: req.params.id,
      userId: req.user.id,
    })
      .sort({ lastMessageAt: -1 })
      .limit(20);

    // Calculate metrics over time
    const monthlyMetrics = await Conversation.aggregate([
      { $match: { contactId: contact._id, userId: req.user._id } },
      {
        $group: {
          _id: {
            year: { $year: '$lastMessageAt' },
            month: { $month: '$lastMessageAt' },
          },
          messages: { $sum: '$metrics.totalMessages' },
          conversations: { $sum: 1 },
          avgResponseTime: { $avg: '$metrics.responseTime.average' },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
    ]);

    // Get sentiment trends
    const sentimentTrends = await Conversation.aggregate([
      { 
        $match: { 
          contactId: contact._id, 
          userId: req.user._id,
          'aiAnalysis.sentiment.overall': { $exists: true }
        } 
      },
      {
        $group: {
          _id: '$aiAnalysis.sentiment.overall',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get communication patterns
    const communicationPatterns = {
      mostActiveDay: contact.metrics.activityPattern?.mostActiveDay || 'unknown',
      mostActiveHour: contact.metrics.activityPattern?.mostActiveHour || 12,
      averageResponseTime: contact.metrics.averageResponseTime,
      reciprocity: contact.metrics.reciprocity,
      interactionFrequency: contact.metrics.interactionFrequency,
    };

    const analytics = {
      contact: {
        id: contact._id,
        name: contact.name,
        status: contact.status,
        metrics: contact.metrics,
      },
      conversations: conversations.length,
      monthlyMetrics,
      sentimentTrends,
      communicationPatterns,
      insights: contact.getInsights(),
    };

    res.json({
      success: true,
      data: { analytics },
    });
  } catch (error) {
    console.error('Get contact analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact analytics',
    });
  }
});

// @route   GET /api/analytics/trends
// @desc    Get relationship trends over time
// @access  Private
router.get('/trends', async (req, res) => {
  try {
    const { period = '90d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    // Get relationship health trends
    const healthTrends = await Contact.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgReciprocity: { $avg: '$metrics.reciprocity' },
        },
      },
    ]);

    // Get communication trends
    const communicationTrends = await Conversation.aggregate([
      { 
        $match: { 
          userId: req.user._id,
          lastMessageAt: { $gte: startDate }
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: '$lastMessageAt' },
            month: { $month: '$lastMessageAt' },
          },
          totalMessages: { $sum: '$metrics.totalMessages' },
          totalConversations: { $sum: 1 },
          avgResponseTime: { $avg: '$metrics.responseTime.average' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Get revived connections (contacts that went from dormant/wilted to healthy)
    const revivedConnections = await Contact.find({
      userId: req.user._id,
      status: 'healthy',
      'metrics.lastContact': { $gte: startDate },
    })
      .sort({ 'metrics.lastContact': -1 })
      .limit(10)
      .select('name status metrics.lastContact');

    const trends = {
      healthTrends,
      communicationTrends,
      revivedConnections,
      period,
    };

    res.json({
      success: true,
      data: { trends },
    });
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trends',
    });
  }
});

module.exports = router;

