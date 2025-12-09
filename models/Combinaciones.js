const mongoose = require('mongoose');

const combinacionSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  ingredientes: [
    {
      ingrediente: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingrediente', required: true },
      gramos: { type: Number, required: true }
    }
  ],
  caloriasTotales: { type: Number, required: true },
  macrosTotales: {
    proteinas: { type: Number, required: true },
    carbohidratos: { type: Number, required: true },
    grasas: { type: Number, required: true }
  }
}, { timestamps: true });

module.exports = mongoose.model('Combinacion', combinacionSchema);
