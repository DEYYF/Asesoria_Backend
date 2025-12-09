const mongoose = require("mongoose");

const TarifaSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    descripcion: {
      type: String,
      default: "",
    },
    precio: {
      type: Number,
      required: true,
    },
    duracionDias: {
      type: Number,
      required: true, // Ej: 30, 90, 180, 365
    },
    tipoServicio: {
      type: String,
      required: true,
      enum: [
        "Dieta",
        "Dieta y asesoramiento",
        "Rutina",
        "Rutina y asesoramiento",
        "Dieta y Rutina",
        "Mensual",
        "Trimestral",
        "Semestral",
        "Anual"
      ],
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tarifa", TarifaSchema);
