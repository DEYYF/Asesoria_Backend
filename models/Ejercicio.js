// models/Ejercicio.js
const mongoose = require('mongoose');

const ejercicioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    set: (v) => normalize(v),
  },
  grupo: { type: String, default: "" },
  equipo: { type: String, default: "" },
  nivel: { type: String, default: "" },
  urlVideo: { type: String, default: "" },
  instrucciones: { type: String, default: "" },
}, { timestamps: true });

// Normalizador
function normalize(str = "") {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

module.exports = mongoose.model("Ejercicio", ejercicioSchema);
