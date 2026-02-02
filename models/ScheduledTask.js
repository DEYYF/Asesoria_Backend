const mongoose = require('mongoose');

const ScheduledTaskSchema = new mongoose.Schema({
  advisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
  automationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Automation' },
  action: { type: mongoose.Schema.Types.Mixed, required: true },
  triggerData: { type: mongoose.Schema.Types.Mixed }, // Original data that triggered it
  executeAt: { type: Date, required: true },
  status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
  error: { type: String }
}, { timestamps: true });

// Index for fast picking of ready tasks
ScheduledTaskSchema.index({ executeAt: 1, status: 1 });

module.exports = mongoose.model('ScheduledTask', ScheduledTaskSchema);
