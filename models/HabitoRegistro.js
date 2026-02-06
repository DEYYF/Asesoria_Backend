const mongoose = require('mongoose');

const habitoRegistroSchema = new mongoose.Schema({
  habitoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habito', required: true },
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  fecha: { type: Date, required: true }, // Normalized to start of day
  completado: { type: Boolean, default: false }, // For checklist
  valor: { type: Number }, // For numeric (e.g., 8500 steps)
  notas: { type: String }
}, { timestamps: true });

// Ensure unique log per habit/client/day
habitoRegistroSchema.index({ habitoId: 1, clienteId: 1, fecha: 1 }, { unique: true });

module.exports = mongoose.model('HabitoRegistro', habitoRegistroSchema);
