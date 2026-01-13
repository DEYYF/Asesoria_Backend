const mongoose = require('mongoose');

const movimientoSchema = new mongoose.Schema({
  asesorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  descripcion: String,
  monto: { type: Number, default: 0 },
  tipoMovimiento: { type: String, enum: ['INGRESO', 'GASTO', 'SISTEMA'], default: 'SISTEMA' },
  categoria: { type: String, default: 'General' },
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
  presupuestoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Presupuesto' },
  fecha: { type: Date, default: Date.now },
  // Keeping Tipo for backward compatibility with existing logs
  Tipo: { type: String, enum: ['CREAR', 'EDITAR', 'BORRAR', 'PROGRESO', "OTRO", "CORREO", "FINANZAS"], default: 'OTRO' }
}, { timestamps: true });

module.exports = mongoose.model('Movimiento', movimientoSchema);
