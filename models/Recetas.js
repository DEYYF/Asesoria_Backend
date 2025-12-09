const mongoose = require('mongoose');

const recetaSchema = new mongoose.Schema({
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
  },
  linkPreparacion: { type: String } // Enlace a Drive u otro recurso externo
}, { timestamps: true });


recetaSchema.index({ nombre: 1 }, { unique: true, collation: { locale: 'es', strength: 2 } });

module.exports = mongoose.model('Receta', recetaSchema);
