const mongoose = require('mongoose');

const CorreoLogSchema = new mongoose.Schema({
  emisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' }, // Optional for bulk emails
  destinatario: { type: String, required: true },
  asunto: { type: String, required: true },
  mensaje: { type: String },
  html: { type: String },
  estado: { type: String, enum: ['Enviado', 'Error'], default: 'Enviado' },
  error: { type: String },
  fecha: { type: Date, default: Date.now },
  attachments: [{
    filename: String,
    path: String, // Or content type
    cid: String
  }]
});

module.exports = mongoose.model('CorreoLog', CorreoLogSchema);
