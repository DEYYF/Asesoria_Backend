const mongoose = require('mongoose');

const habitoPresetSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  descripcion: { type: String },
  tipo: { type: String, enum: ['checklist', 'numeric'], default: 'checklist' },
  unidad: { type: String }, // For numeric habits (e.g., "litros", "pasos")
  target: { type: Number }, // Suggested target for numeric habits
  categoria: { type: String, enum: ['salud', 'productividad', 'bienestar', 'fitness', 'nutricion', 'otro'], default: 'otro' },
  icono: { type: String }, // Icon name for UI
  orden: { type: Number, default: 0 },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('HabitoPreset', habitoPresetSchema);
