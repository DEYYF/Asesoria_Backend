// models/Ejercicio.js
const mongoose = require('mongoose');

const ejercicioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    set: (v) => normalize(v),
  },
  grupo: String,
  equipo: String,
  nivel: String,
  urlVideo: String,
  instrucciones: String,
}, { timestamps: true });

// 👇 añade la función aquí mismo
function normalize(str = "") {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

module.exports = mongoose.model("Ejercicio", ejercicioSchema);




ejercicioSchema.index(
  { createdBy: 1, nombreNormalized: 1 },
  { unique: true, collation: { locale: 'es', strength: 2 } }
);

// Middleware para normalizar el nombre antes de guardar
ejercicioSchema.pre('save', function(next) {
  if (this.isModified('nombre')) {
    this.nombreNormalized = normalize(this.nombre);
  }
  next();
});

const Ejercicio = mongoose.model('Ejercicio', ejercicioSchema);
module.exports = Ejercicio;
