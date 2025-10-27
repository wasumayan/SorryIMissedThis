const express = require('express');
const { body, validationResult } = require('express-validator');
const Contact = require('../models/Contact');

const router = express.Router();

// @route   GET /api/contacts
// @desc    Get all contacts for user
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { category, status, search } = req.query;
    
    // Build filter object
    const filter = { userId: req.user.id };
    
    if (category && category !== 'All') {
      filter.category = category.toLowerCase();
    }
    
    if (status && status !== 'All') {
      if (status === 'Dormant') {
        filter.status = { $in: ['dormant', 'wilted'] };
      } else if (status === 'Priority') {
        filter.status = { $in: ['attention', 'wilted'] };
      } else {
        filter.status = status.toLowerCase();
      }
    }
    
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const contacts = await Contact.find(filter)
      .sort({ 'metrics.lastContact': -1 })
      .lean();

    // Calculate grove positions for visualization
    const positionedContacts = contacts.map((contact, index) => {
      const centerX = 500;
      const centerY = 350;
      const categoryAngles = { 
        family: -70,
        friends: 0, 
        work: 70 
      };

      const baseAngle = categoryAngles[contact.category];
      const spread = 35;
      const angleOffset = (index % 5) * spread - spread * 2;
      const angle = ((baseAngle + angleOffset) * Math.PI) / 180;
      
      const baseDistance = 120;
      const maxDistance = 280;
      const distance = baseDistance + (1 - (contact.recency || 0.5)) * (maxDistance - baseDistance);

      return {
        ...contact,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        rotation: angle * (180 / Math.PI) + 90,
        branchLength: distance,
      };
    });

    res.json({
      success: true,
      data: {
        contacts: positionedContacts,
        total: contacts.length,
      },
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contacts',
    });
  }
});

// @route   GET /api/contacts/:id
// @desc    Get single contact
// @access  Private
router.get('/:id', async (req, res) => {
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

    // Get insights for this contact
    const insights = contact.getInsights();

    res.json({
      success: true,
      data: {
        contact,
        insights,
      },
    });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact',
    });
  }
});

// @route   POST /api/contacts
// @desc    Create new contact
// @access  Private
router.post('/', [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required'),
  body('category').isIn(['family', 'friends', 'work']).withMessage('Invalid category'),
  body('phoneNumber').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('email').optional().isEmail().withMessage('Invalid email'),
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { name, category, phoneNumber, email, platforms, notes } = req.body;

    const contact = new Contact({
      userId: req.user.id,
      name,
      category,
      phoneNumber,
      email,
      platforms: platforms || [],
      notes,
    });

    await contact.save();

    res.status(201).json({
      success: true,
      message: 'Contact created successfully',
      data: { contact },
    });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create contact',
    });
  }
});

// @route   PUT /api/contacts/:id
// @desc    Update contact
// @access  Private
router.put('/:id', [
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('category').optional().isIn(['family', 'friends', 'work']).withMessage('Invalid category'),
  body('phoneNumber').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('email').optional().isEmail().withMessage('Invalid email'),
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

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

    // Update fields
    const allowedUpdates = ['name', 'category', 'phoneNumber', 'email', 'platforms', 'notes', 'tags'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        contact[field] = req.body[field];
      }
    });

    await contact.save();

    res.json({
      success: true,
      message: 'Contact updated successfully',
      data: { contact },
    });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update contact',
    });
  }
});

// @route   DELETE /api/contacts/:id
// @desc    Delete contact
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const contact = await Contact.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }

    res.json({
      success: true,
      message: 'Contact deleted successfully',
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete contact',
    });
  }
});

// @route   POST /api/contacts/:id/update-metrics
// @desc    Update contact metrics after interaction
// @access  Private
router.post('/:id/update-metrics', [
  body('messageCount').optional().isInt({ min: 0 }).withMessage('Message count must be non-negative'),
  body('responseTime').optional().isFloat({ min: 0 }).withMessage('Response time must be non-negative'),
], async (req, res) => {
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

    const { messageCount = 1, responseTime = null } = req.body;
    await contact.updateMetrics(messageCount, responseTime);

    res.json({
      success: true,
      message: 'Metrics updated successfully',
      data: { contact },
    });
  } catch (error) {
    console.error('Update metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update metrics',
    });
  }
});

// @route   GET /api/contacts/stats/summary
// @desc    Get contacts summary statistics
// @access  Private
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await Contact.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          healthy: { $sum: { $cond: [{ $eq: ['$status', 'healthy'] }, 1, 0] } },
          attention: { $sum: { $cond: [{ $eq: ['$status', 'attention'] }, 1, 0] } },
          dormant: { $sum: { $cond: [{ $eq: ['$status', 'dormant'] }, 1, 0] } },
          wilted: { $sum: { $cond: [{ $eq: ['$status', 'wilted'] }, 1, 0] } },
          family: { $sum: { $cond: [{ $eq: ['$category', 'family'] }, 1, 0] } },
          friends: { $sum: { $cond: [{ $eq: ['$category', 'friends'] }, 1, 0] } },
          work: { $sum: { $cond: [{ $eq: ['$category', 'work'] }, 1, 0] } },
        },
      },
    ]);

    const result = stats[0] || {
      total: 0,
      healthy: 0,
      attention: 0,
      dormant: 0,
      wilted: 0,
      family: 0,
      friends: 0,
      work: 0,
    };

    res.json({
      success: true,
      data: { stats: result },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

module.exports = router;

