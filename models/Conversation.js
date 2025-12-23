const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  type: { type: String, enum: ['advisor-client', 'advisor-advisor'], default: 'advisor-client' },
  asesorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
  recipientAsesorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Flexible unique index
ConversationSchema.index({ asesorId: 1, clienteId: 1, recipientAsesorId: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', ConversationSchema);
