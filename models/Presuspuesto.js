const mongoose = require("mongoose");
const { Schema } = mongoose;

const PresupuestoSchema = new Schema(
  {
    clienteId: {
      type: Schema.Types.ObjectId,
      ref: "Cliente",
      required: false, // Opcional para borradores
    },
    nombreCliente: String, // Para borradores
    emailCliente: String,  // Para borradores
    usuarioId: {
      type: Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
    },
    tarifaId: {
      type: Schema.Types.ObjectId,
      ref: "Tarifa",
      required: true,
    },
    extras: [
      {
        extraId: {
          type: Schema.Types.ObjectId,
          ref: "Extra",
        },
        precio: Number, // se guarda el precio al momento del presupuesto
        precioTotal: Number, // Precio calculado (mensual * meses)
      },
    ],
    total: {
      type: Number,
      required: true,
    },
    fechaInicio: Date,
    fechaFin: Date,
    estado: {
      type: String,
      enum: ["pendiente", "aceptado", "rechazado", "pagado", "borrador"],
      default: "pendiente",
    },
    descuento: {
      type: Number, // Porcentaje 0-100
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Presupuesto", PresupuestoSchema);
