const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  asesorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true 
  },
  title: { type: String, required: true },
  categories: [{ 
    type: String, 
    enum: ['General', 'Dieta', 'Entreno', 'Seguimiento', 'Cobros', 'Otros'], 
    default: 'General' 
  }],
  type: { 
    type: String, 
    enum: ['email', 'chat', 'both'], 
    default: 'email' 
  },
  subject: { type: String }, // For email
  content: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Template', templateSchema);
