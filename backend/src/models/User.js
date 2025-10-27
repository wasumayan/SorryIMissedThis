const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  preferences: {
    privacy: {
      localOnly: {
        type: Boolean,
        default: true,
      },
      cloudSync: {
        type: Boolean,
        default: false,
      },
      dataRetention: {
        type: Number,
        default: 365, // days
      },
    },
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: true,
      },
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        default: 'weekly',
      },
    },
    ai: {
      promptStyle: {
        type: String,
        enum: ['formal', 'friendly', 'playful'],
        default: 'friendly',
      },
      autoAnalysis: {
        type: Boolean,
        default: true,
      },
    },
  },
  connectedPlatforms: {
    whatsapp: {
      connected: {
        type: Boolean,
        default: false,
      },
      sessionId: String,
      lastSync: Date,
    },
    telegram: {
      connected: {
        type: Boolean,
        default: false,
      },
      userId: String,
      lastSync: Date,
    },
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    },
  },
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Update last active timestamp
userSchema.methods.updateLastActive = function() {
  this.lastActive = new Date();
  return this.save();
};

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ 'connectedPlatforms.whatsapp.connected': 1 });
userSchema.index({ 'connectedPlatforms.telegram.connected': 1 });

module.exports = mongoose.model('User', userSchema);

