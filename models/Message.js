const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  senderType: { type: String, enum: ['ASESOR', 'CLIENTE'], required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  text: { type: String, required: true },
  buttons: [{
    text: String,
    action: String,
    payload: mongoose.Schema.Types.Mixed
  }],
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for fast retrieval of conversation messages
MessageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
