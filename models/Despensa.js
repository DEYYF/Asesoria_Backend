const mongoose = require('mongoose');

const despensaSchema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  nombreIngrediente: { type: String, required: true },
  cantidad: { type: Number, default: 0 },
  unidad: { type: String, default: 'g' },
  categoria: { type: String, default: 'General' },
  ultimaActualizacion: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for quick lookups by client
despensaSchema.index({ clienteId: 1, nombreIngrediente: 1 }, { unique: true });

module.exports = mongoose.model('Despensa', despensaSchema);
