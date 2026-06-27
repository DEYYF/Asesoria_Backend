
const mongoose = require("mongoose");

const TareaSchema = new mongoose.Schema(
  {
    title:   { type: String, required: true, trim: true },
    notes:   { type: String, default: "" },
    status:  { type: String, default: "todo", index: true },
    dueAt:   { type: Date },

    // relaciones / metadatos
    clientId:   { type: mongoose.Schema.Types.ObjectId, ref: "Cliente" },
    clientName: String,
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario" },
    origin:     { type: String, enum: ["manual", "cita", "renovacion", "pago"], default: "manual" },
    metadata:   { type: mongoose.Schema.Types.Mixed },

    // auditoría simple (opcional)
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: "Usuario" },
    updatedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "Usuario" },
  },
  { timestamps: true }
);

TareaSchema.index({ createdAt: -1 });
TareaSchema.index({ dueAt: 1 });

module.exports = mongoose.model("Tarea", TareaSchema);
