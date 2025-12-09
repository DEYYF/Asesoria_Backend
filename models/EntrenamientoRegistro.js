// models/EntrenamientoRegistro.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const RegistroSerieSchema = new Schema({
  peso: { type: Number, default: 0 },
  reps: { type: Number, default: 0 },
  rir: { type: Number, default: 0 },
}, { _id: false });

const RegistroEjercicioSchema = new Schema({
  ejercicio: { type: Schema.Types.ObjectId, ref: 'Ejercicio' }, // ref si existe
  ejercicioNombre: { type: String }, // backup nombre
  series: { type: [RegistroSerieSchema], default: [] },
  notas: { type: String, default: "" }
}, { _id: true });

const EntrenamientoRegistroSchema = new Schema({
  entrenamientoId: { type: Schema.Types.ObjectId, ref: 'Entrenamiento', required: true },
  clienteId: { type: Schema.Types.ObjectId, ref: 'Cliente', required: true },
  
  fecha: { type: Date, default: Date.now },
  semanaNumero: { type: Number, required: true }, // Semana del plan (1, 2...)
  diaNombre: { type: String, required: true },   // "Día 1", "Pierna", etc.

  ejercicios: { type: [RegistroEjercicioSchema], default: [] },
  comentarios: { type: String, default: "" }, // Notas generales de la sesión
}, { timestamps: true });

module.exports = mongoose.model('EntrenamientoRegistro', EntrenamientoRegistroSchema);
