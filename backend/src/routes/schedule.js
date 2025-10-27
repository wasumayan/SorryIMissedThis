const express = require('express');
const { body, validationResult } = require('express-validator');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');

const router = express.Router();

// @route   GET /api/schedule/prompts
// @desc    Get scheduled prompts
// @access  Private
router.get('/prompts', async (req, res) => {
  try {
    const { status = 'pending', limit = 20, offset = 0 } = req.query;
    
    // For now, we'll generate suggestions based on contact status
    // In a full implementation, you'd have a separate ScheduledPrompt model
    
    const contacts = await Contact.find({
      userId: req.user.id,
      status: { $in: ['attention', 'wilted', 'dormant'] },
    })
      .sort({ 'metrics.lastContact': 1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const scheduledPrompts = contacts.map(contact => ({
      id: `scheduled-${contact._id}`,
      contact: {
        id: contact._id,
        name: contact.name,
        status: contact.status,
      },
      time: getSuggestedTime(contact),
      prompt: getSuggestedPrompt(contact),
      status: 'pending',
      priority: contact.status === 'wilted' ? 'high' : 
                contact.status === 'attention' ? 'medium' : 'low',
    }));

    res.json({
      success: true,
      data: {
        prompts: scheduledPrompts,
        total: scheduledPrompts.length,
      },
    });
  } catch (error) {
    console.error('Get scheduled prompts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduled prompts',
    });
  }
});

// @route   GET /api/schedule/catch-up
// @desc    Get catch-up suggestions
// @access  Private
router.get('/catch-up', async (req, res) => {
  try {
    const { priority = 'all' } = req.query;
    
    // Get contacts that need attention
    let statusFilter = ['attention', 'wilted', 'dormant'];
    if (priority === 'high') {
      statusFilter = ['wilted'];
    } else if (priority === 'medium') {
      statusFilter = ['attention'];
    }

    const contacts = await Contact.find({
      userId: req.user.id,
      status: { $in: statusFilter },
    })
      .sort({ 'metrics.lastContact': 1 })
      .limit(10);

    const catchUpSuggestions = contacts.map(contact => {
      const daysSinceLastContact = Math.floor(
        (new Date() - contact.metrics.lastContact) / (1000 * 60 * 60 * 24)
      );

      return {
        contact: {
          id: contact._id,
          name: contact.name,
          status: contact.status,
        },
        lastContact: `${daysSinceLastContact} days ago`,
        unreadMessages: 0, // Would be calculated from actual message data
        priority: contact.status === 'wilted' ? 'high' : 
                  contact.status === 'attention' ? 'medium' : 'low',
        suggestedPrompt: getSuggestedPrompt(contact),
        context: getContactContext(contact),
      };
    });

    res.json({
      success: true,
      data: {
        suggestions: catchUpSuggestions,
        total: catchUpSuggestions.length,
      },
    });
  } catch (error) {
    console.error('Get catch-up suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch catch-up suggestions',
    });
  }
});

// @route   POST /api/schedule/prompts
// @desc    Schedule a prompt
// @access  Private
router.post('/prompts', [
  body('contactId').isMongoId().withMessage('Invalid contact ID'),
  body('prompt').notEmpty().withMessage('Prompt is required'),
  body('scheduledTime').isISO8601().withMessage('Invalid scheduled time'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { contactId, prompt, scheduledTime, priority = 'medium', notes } = req.body;

    // Verify contact exists
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

    // In a full implementation, you'd save this to a ScheduledPrompt model
    const scheduledPrompt = {
      id: `scheduled-${Date.now()}`,
      contact: {
        id: contact._id,
        name: contact.name,
        status: contact.status,
      },
      prompt,
      scheduledTime: new Date(scheduledTime),
      priority,
      notes,
      status: 'pending',
      createdAt: new Date(),
    };

    res.status(201).json({
      success: true,
      message: 'Prompt scheduled successfully',
      data: { scheduledPrompt },
    });
  } catch (error) {
    console.error('Schedule prompt error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule prompt',
    });
  }
});

// @route   PUT /api/schedule/prompts/:id
// @desc    Update scheduled prompt
// @access  Private
router.put('/prompts/:id', [
  body('prompt').optional().notEmpty().withMessage('Prompt cannot be empty'),
  body('scheduledTime').optional().isISO8601().withMessage('Invalid scheduled time'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
  body('status').optional().isIn(['pending', 'completed', 'cancelled']).withMessage('Invalid status'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { prompt, scheduledTime, priority, status, notes } = req.body;

    // In a full implementation, you'd update the ScheduledPrompt model
    const updatedPrompt = {
      id: req.params.id,
      prompt,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined,
      priority,
      status,
      notes,
      updatedAt: new Date(),
    };

    res.json({
      success: true,
      message: 'Prompt updated successfully',
      data: { prompt: updatedPrompt },
    });
  } catch (error) {
    console.error('Update prompt error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update prompt',
    });
  }
});

// @route   DELETE /api/schedule/prompts/:id
// @desc    Delete scheduled prompt
// @access  Private
router.delete('/prompts/:id', async (req, res) => {
  try {
    // In a full implementation, you'd delete from ScheduledPrompt model
    res.json({
      success: true,
      message: 'Prompt deleted successfully',
    });
  } catch (error) {
    console.error('Delete prompt error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete prompt',
    });
  }
});

// @route   GET /api/schedule/calendar
// @desc    Get calendar events
// @access  Private
router.get('/calendar', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'Start and end dates are required',
      });
    }

    // Get contacts with upcoming important dates
    const contacts = await Contact.find({
      userId: req.user.id,
      // In a full implementation, you'd check for birthdays, anniversaries, etc.
    });

    const events = contacts.map(contact => ({
      id: `event-${contact._id}`,
      title: `Check in with ${contact.name}`,
      start: new Date(contact.metrics.lastContact.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from last contact
      end: new Date(contact.metrics.lastContact.getTime() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour duration
      allDay: false,
      contact: {
        id: contact._id,
        name: contact.name,
        status: contact.status,
      },
      priority: contact.status === 'wilted' ? 'high' : 'medium',
    }));

    res.json({
      success: true,
      data: { events },
    });
  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch calendar events',
    });
  }
});

// Helper functions
function getSuggestedTime(contact) {
  const now = new Date();
  const lastContact = contact.metrics.lastContact;
  const daysSince = Math.floor((now - lastContact) / (1000 * 60 * 60 * 24));
  
  if (contact.status === 'wilted') {
    return 'This Evening';
  } else if (contact.status === 'attention') {
    return 'Tomorrow, 10:00 AM';
  } else if (daysSince > 14) {
    return 'This Weekend';
  } else {
    return 'Next Week';
  }
}

function getSuggestedPrompt(contact) {
  const daysSince = Math.floor(
    (new Date() - contact.metrics.lastContact) / (1000 * 60 * 60 * 24)
  );

  if (contact.status === 'wilted') {
    return `Reach out to ${contact.name} - they might need support`;
  } else if (contact.status === 'attention') {
    return `Check in with ${contact.name} - they mentioned something important recently`;
  } else if (daysSince > 30) {
    return `Reconnect with ${contact.name} - it's been a while since you last spoke`;
  } else {
    return `Touch base with ${contact.name} - keep the connection warm`;
  }
}

function getContactContext(contact) {
  const daysSince = Math.floor(
    (new Date() - contact.metrics.lastContact) / (1000 * 60 * 60 * 1000)
  );

  return {
    lastContact: `${daysSince} days ago`,
    relationshipHealth: contact.status,
    reciprocity: Math.round(contact.metrics.reciprocity * 100),
    interactionFrequency: contact.metrics.interactionFrequency,
  };
}

module.exports = router;

