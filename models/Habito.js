const mongoose = require('mongoose');

const habitoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  descripcion: { type: String },
  tipo: { type: String, enum: ['checklist', 'numeric'], default: 'checklist' },
  unidad: { type: String }, // For numeric habits (e.g., "litros", "pasos")
  target: { type: Number }, // For numeric habits (e.g., 2 liters, 10000 steps)
  frecuencia: { type: String, enum: ['diario', 'semanal'], default: 'diario' },
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  asesorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  activo: { type: Boolean, default: true },
  orden: { type: Number, default: 0 },
  chartType: { type: String },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habito' },
  parentCondition: { type: String, enum: ['si', 'no', '>', '<', '>=', '<=', '=='] },
  parentValue: { type: Number }
}, { timestamps: true });

module.exports = mongoose.model('Habito', habitoSchema);
