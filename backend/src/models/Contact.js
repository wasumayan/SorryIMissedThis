const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    enum: ['family', 'friends', 'work'],
    required: true,
  },
  status: {
    type: String,
    enum: ['healthy', 'attention', 'dormant', 'wilted'],
    default: 'healthy',
  },
  // Visual properties for the grove
  size: {
    type: Number,
    min: 0.1,
    max: 1.0,
    default: 0.5,
  },
  closeness: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5,
  },
  recency: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5,
  },
  // Contact information
  phoneNumber: String,
  email: String,
  platforms: [{
    type: {
      type: String,
      enum: ['whatsapp', 'telegram', 'sms', 'email'],
    },
    identifier: String, // phone number, username, etc.
    lastMessage: Date,
  }],
  // Relationship metrics
  metrics: {
    totalMessages: {
      type: Number,
      default: 0,
    },
    lastContact: {
      type: Date,
      default: Date.now,
    },
    averageResponseTime: {
      type: Number, // in hours
      default: 24,
    },
    reciprocity: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },
    interactionFrequency: {
      type: Number, // messages per week
      default: 1,
    },
  },
  // AI analysis
  aiAnalysis: {
    personality: {
      type: String,
      enum: ['formal', 'casual', 'humorous', 'supportive', 'analytical'],
    },
    communicationStyle: {
      type: String,
      enum: ['brief', 'detailed', 'emotional', 'practical'],
    },
    preferredTopics: [String],
    relationshipDynamics: {
      type: String,
      enum: ['equal', 'supportive', 'mentor', 'mentee', 'professional'],
    },
    lastAnalyzed: Date,
  },
  // Visual positioning in grove
  position: {
    x: Number,
    y: Number,
    rotation: Number,
  },
  // Tags and notes
  tags: [String],
  notes: String,
  // Privacy settings
  privacy: {
    includeInAnalysis: {
      type: Boolean,
      default: true,
    },
    shareMetrics: {
      type: Boolean,
      default: false,
    },
  },
}, {
  timestamps: true,
});

// Calculate relationship health score
contactSchema.methods.calculateHealthScore = function() {
  const now = new Date();
  const daysSinceLastContact = Math.floor((now - this.metrics.lastContact) / (1000 * 60 * 60 * 24));
  
  // Factors affecting health
  const recencyScore = Math.max(0, 1 - (daysSinceLastContact / 30)); // Decays over 30 days
  const reciprocityScore = this.metrics.reciprocity;
  const frequencyScore = Math.min(1, this.metrics.interactionFrequency / 7); // Normalize to weekly
  
  // Weighted average
  const healthScore = (recencyScore * 0.4) + (reciprocityScore * 0.4) + (frequencyScore * 0.2);
  
  // Determine status based on score
  if (healthScore >= 0.8) return 'healthy';
  if (healthScore >= 0.6) return 'attention';
  if (healthScore >= 0.3) return 'dormant';
  return 'wilted';
};

// Update relationship metrics
contactSchema.methods.updateMetrics = function(messageCount = 1, responseTime = null) {
  this.metrics.totalMessages += messageCount;
  this.metrics.lastContact = new Date();
  
  if (responseTime !== null) {
    // Update average response time with exponential moving average
    const alpha = 0.1; // Smoothing factor
    this.metrics.averageResponseTime = (alpha * responseTime) + ((1 - alpha) * this.metrics.averageResponseTime);
  }
  
  // Update status based on new metrics
  this.status = this.calculateHealthScore();
  
  return this.save();
};

// Get relationship insights
contactSchema.methods.getInsights = function() {
  const insights = [];
  
  if (this.metrics.reciprocity < 0.3) {
    insights.push('Low reciprocity - consider reaching out more often');
  }
  
  if (this.metrics.averageResponseTime > 48) {
    insights.push('Slow response times - they might be busy');
  }
  
  if (this.status === 'dormant' || this.status === 'wilted') {
    insights.push('Relationship needs attention - suggest a catch-up');
  }
  
  return insights;
};

// Indexes for performance
contactSchema.index({ userId: 1, status: 1 });
contactSchema.index({ userId: 1, 'metrics.lastContact': -1 });
contactSchema.index({ userId: 1, category: 1 });
contactSchema.index({ userId: 1, name: 'text' });

module.exports = mongoose.model('Contact', contactSchema);

