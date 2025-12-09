const mongoose = require('mongoose');

const movimientoSchema = new mongoose.Schema({
  asesorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  descripcion: String,
  fecha: { type: Date, default: Date.now },
  Tipo: { type: String, enum: ['CREAR', 'EDITAR', 'BORRAR', 'PROGRESO', "OTRO", "CORREO"], default: 'CREAR' }
});

module.exports = mongoose.model('Movimiento', movimientoSchema);
