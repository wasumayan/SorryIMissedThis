const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  sender: {
    type: String,
    enum: ['user', 'contact'],
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    required: true,
  },
  platform: {
    type: String,
    enum: ['whatsapp', 'telegram', 'sms', 'email'],
    required: true,
  },
  metadata: {
    isRead: {
      type: Boolean,
      default: false,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    replyTo: String, // ID of message being replied to
    attachments: [{
      type: {
        type: String,
        enum: ['image', 'video', 'audio', 'document', 'sticker'],
      },
      url: String,
      filename: String,
      size: Number,
    }],
  },
});

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: true,
  },
  platform: {
    type: String,
    enum: ['whatsapp', 'telegram', 'sms', 'email'],
    required: true,
  },
  platformConversationId: {
    type: String, // Original conversation ID from platform
    required: true,
  },
  messages: [messageSchema],
  // AI Analysis
  aiAnalysis: {
    summary: String,
    sentiment: {
      overall: {
        type: String,
        enum: ['positive', 'neutral', 'negative'],
      },
      userSentiment: {
        type: String,
        enum: ['positive', 'neutral', 'negative'],
      },
      contactSentiment: {
        type: String,
        enum: ['positive', 'neutral', 'negative'],
      },
    },
    topics: [{
      topic: String,
      confidence: Number,
      mentions: Number,
    }],
    keyMoments: [{
      timestamp: Date,
      description: String,
      importance: {
        type: String,
        enum: ['low', 'medium', 'high'],
      },
    }],
    followUpSuggestions: [{
      suggestion: String,
      reason: String,
      priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
      },
      timing: {
        type: String,
        enum: ['immediate', 'soon', 'later'],
      },
    }],
    lastAnalyzed: Date,
  },
  // Conversation metrics
  metrics: {
    totalMessages: {
      type: Number,
      default: 0,
    },
    userMessages: {
      type: Number,
      default: 0,
    },
    contactMessages: {
      type: Number,
      default: 0,
    },
    averageMessageLength: {
      type: Number,
      default: 0,
    },
    responseTime: {
      average: Number, // in hours
      userAverage: Number,
      contactAverage: Number,
    },
    activityPattern: {
      mostActiveDay: {
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      },
      mostActiveHour: {
        type: Number,
        min: 0,
        max: 23,
      },
    },
  },
  // Privacy and processing
  privacy: {
    isProcessed: {
      type: Boolean,
      default: false,
    },
    processingDate: Date,
    includeInAnalysis: {
      type: Boolean,
      default: true,
    },
  },
  // Timestamps
  startedAt: {
    type: Date,
    default: Date.now,
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Calculate conversation metrics
conversationSchema.methods.calculateMetrics = function() {
  const messages = this.messages;
  if (messages.length === 0) return;
  
  // Count messages by sender
  const userMessages = messages.filter(m => m.sender === 'user');
  const contactMessages = messages.filter(m => m.sender === 'contact');
  
  this.metrics.totalMessages = messages.length;
  this.metrics.userMessages = userMessages.length;
  this.metrics.contactMessages = contactMessages.length;
  
  // Calculate average message length
  const totalLength = messages.reduce((sum, msg) => sum + msg.text.length, 0);
  this.metrics.averageMessageLength = totalLength / messages.length;
  
  // Calculate response times
  let totalResponseTime = 0;
  let responseCount = 0;
  
  for (let i = 1; i < messages.length; i++) {
    const current = messages[i];
    const previous = messages[i - 1];
    
    if (current.sender !== previous.sender) {
      const responseTime = (current.timestamp - previous.timestamp) / (1000 * 60 * 60); // hours
      totalResponseTime += responseTime;
      responseCount++;
    }
  }
  
  if (responseCount > 0) {
    this.metrics.responseTime.average = totalResponseTime / responseCount;
  }
  
  // Find most active day and hour
  const dayCounts = {};
  const hourCounts = {};
  
  messages.forEach(msg => {
    const day = msg.timestamp.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const hour = msg.timestamp.getHours();
    
    dayCounts[day] = (dayCounts[day] || 0) + 1;
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  this.metrics.activityPattern.mostActiveDay = Object.keys(dayCounts).reduce((a, b) => 
    dayCounts[a] > dayCounts[b] ? a : b
  );
  this.metrics.activityPattern.mostActiveHour = Object.keys(hourCounts).reduce((a, b) => 
    hourCounts[a] > hourCounts[b] ? a : b
  );
};

// Get conversation summary
conversationSchema.methods.getSummary = function() {
  if (!this.aiAnalysis.summary) {
    return 'No summary available';
  }
  
  return {
    summary: this.aiAnalysis.summary,
    sentiment: this.aiAnalysis.sentiment.overall,
    keyTopics: this.aiAnalysis.topics.slice(0, 3).map(t => t.topic),
    followUpSuggestions: this.aiAnalysis.followUpSuggestions.filter(s => s.priority === 'high'),
  };
};

// Indexes for performance
conversationSchema.index({ userId: 1, contactId: 1 });
conversationSchema.index({ userId: 1, platform: 1 });
conversationSchema.index({ userId: 1, 'lastMessageAt': -1 });
conversationSchema.index({ 'platformConversationId': 1 });
conversationSchema.index({ 'privacy.isProcessed': 1 });

module.exports = mongoose.model('Conversation', conversationSchema);

