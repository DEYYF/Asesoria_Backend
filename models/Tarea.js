
const mongoose = require("mongoose");

const TareaSchema = new mongoose.Schema(
  {
    title:   { type: String, required: true, trim: true },
    notes:   { type: String, default: "" },
    status:  { type: String, default: "todo", index: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    subtasks: [{
      title: { type: String, required: true },
      isCompleted: { type: Boolean, default: false }
    }],
    tags: [{
      label: { type: String, required: true },
      color: { type: String, default: 'blue' }
    }],
    attachments: [{
      url: String,
      name: String,
      type: String
    }],
    statusChangedAt: { type: Date, default: Date.now },
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
