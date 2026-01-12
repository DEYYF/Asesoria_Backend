const mongoose = require('mongoose');

const AutomationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  active: { type: Boolean, default: true },
  
  // EVENT (based on trigger) or SCHEDULED (one-time/recurring)
  type: { type: String, enum: ['EVENT', 'SCHEDULED'], default: 'EVENT' },
  
  // TRIGGER: What event starts this automation (for type: EVENT)
  trigger: { 
    type: String, 
    required: false,
    enum: ['CLIENT_REGISTERED', 'BUDGET_CREATED', 'APPOINTMENT_CREATED', 'APPOINTMENT_MISSED', 'BUDGET_ACCEPTED']
  },

  // SCHEDULE: For type: SCHEDULED
  scheduledDate: { type: Date }, // Specific date/time (one-time)
  daysOfWeek: [{ type: Number }], // 0-6 (Weekly recurring)
  hour: { type: Number }, // 0-23
  minute: { type: Number }, // 0-59
  lastExecutedAt: { type: Date }, // To prevent double execution in same window
  
  // TARGETING: Who receives this
  targetClientIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' }],
  allClients: { type: Boolean, default: false },
  
  // CONDITIONS: Optional filters (e.g. only for premium clients)
  // For now simple JSON field for future expansion
  conditions: { type: mongoose.Schema.Types.Mixed, default: {} },
  
  // ACTIONS: What to do
  actions: [{
    type: { type: String, enum: ['SEND_EMAIL', 'SEND_CHAT'], required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
    contentOverride: { type: String }, // If not using a template
    delay: { type: Number, default: 0 }, // In minutes
  }],
  
  advisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Automation', AutomationSchema);
