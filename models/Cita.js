const mongoose = require("mongoose");

const CitaSchema = new mongoose.Schema(
  {
    asesorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    title: { type: String, required: true },
    date: { type: String, required: true },  // 'YYYY-MM-DD'
    hora: { type: String },                  // 'HH:mm'
    horaFin: { type: String },               // 'HH:mm'
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: "Cliente" },
    color: { type: String },
    notas: { type: String },
    reminder24Sent: { type: Boolean, default: false },
    reminder2hSent: { type: Boolean, default: false },
    asistio: { type: Boolean, default: null },
    asistio_cliente: { type: Boolean, default: null },
    googleEventId: { type: String }
  },
  { timestamps: true }
);

CitaSchema.index({ asesorId: 1, date: 1, hora: 1 });
CitaSchema.index({ clienteId: 1, date: 1 });
module.exports = mongoose.model("Cita", CitaSchema);
