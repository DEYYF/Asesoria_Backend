const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  asesorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Ensure unique conversation per pair
ConversationSchema.index({ asesorId: 1, clienteId: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', ConversationSchema);
