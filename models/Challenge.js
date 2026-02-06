const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  asesorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  targetHabitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habito' },
  targetType: { 
    type: String, 
    enum: ['days_completed', 'total_value', 'all_habits'],
    default: 'days_completed'
  },
  targetValue: { type: Number, required: true }, // e.g., 7 days, 10000 steps total
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  xpReward: { type: Number, default: 100 },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
  progress: { type: Number, default: 0 } // Current progress towards target
}, { timestamps: true });

// Index for efficient queries
challengeSchema.index({ clienteId: 1, endDate: -1 });
challengeSchema.index({ asesorId: 1, createdAt: -1 });

module.exports = mongoose.model('Challenge', challengeSchema);
