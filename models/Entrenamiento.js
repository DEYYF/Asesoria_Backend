// models/Entrenamiento.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const SetSchema = new Schema(
  {
    series: { type: Number, min: 1, default: 3 },
    repsMin: { type: Number, min: 1, default: 8 },
    repsMax: { type: Number, min: 1, default: 12 },
    rir: { type: Number, min: 0, max: 5 },  // reps en recámara (opcional)
    descanso: { type: Number, min: 0 }, // en segundos
    notas: { type: String, trim: true },
  },
  { _id: false }
);

const ItemSchema = new Schema(
  {
    ejercicio: { type: Schema.Types.ObjectId, ref: 'Ejercicio', required: true },
    orden: { type: Number, default: 0 },
    grupoId: { type: String, trim: true }, // para superseries/circuitos (mismo grupoId = enlazados)
    esquema: { type: SetSchema, default: () => ({}) },
  },
  { _id: true }
);

const DiaSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true }, // Lunes, Día 1, etc.
    diaSemana: { type: String, enum: ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'] }, // etiqueta opcional día de la semana
    items: { type: [ItemSchema], default: [] },
  },
  { _id: true }
);

const SemanaSchema = new Schema(
  {
    numero: { type: Number, min: 1, default: 1 },
    dias: { type: [DiaSchema], default: [] },
  },
  { _id: true }
);

const EntrenamientoSchema = new Schema(
  {
    asesorid: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    clienteId: { type: Schema.Types.ObjectId, ref: 'Cliente' },

    titulo: { type: String, required: true, trim: true },
    objetivo: { type: String, trim: true },

    semanas: { type: [SemanaSchema], default: [] },

    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Índices útiles
EntrenamientoSchema.index({ asesorid: 1, clienteId: 1, updatedAt: -1 });
EntrenamientoSchema.index({ titulo: 'text', objetivo: 'text' });

module.exports = mongoose.model('Entrenamiento', EntrenamientoSchema);
