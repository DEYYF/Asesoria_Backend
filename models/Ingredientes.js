// Ingredientes.js
const mongoose = require('mongoose');

const ingredienteSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  tipo: { type: String, required: true },
  kcal: { type: Number, required: true }, // por 100g
  proteinas: { type: Number, required: true },
  carbohidratos: { type: Number, required: true },
  grasas: { type: Number, required: true }
});

ingredienteSchema.index({ nombre: 1 }, { unique: true, collation: { locale: 'es', strength: 2 } });


module.exports = mongoose.model('Ingrediente', ingredienteSchema);
