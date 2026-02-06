const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  badgeType: { 
    type: String, 
    required: true,
    enum: [
      'STREAK_7',
      'STREAK_30',
      'STREAK_100',
      'HABIT_MASTER',
      'LEVEL_5',
      'LEVEL_10',
      'LEVEL_20',
      'LEVEL_50',
      'CHALLENGE_CHAMPION',
      'PERFECT_WEEK',
      'PERFECT_MONTH'
    ]
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, required: true }, // Icon name or emoji
  category: { 
    type: String, 
    enum: ['streaks', 'habits', 'levels', 'challenges'],
    required: true 
  },
  unlockedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Ensure a client can only unlock each badge type once
badgeSchema.index({ clienteId: 1, badgeType: 1 }, { unique: true });

module.exports = mongoose.model('Badge', badgeSchema);
