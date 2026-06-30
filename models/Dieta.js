// models/Dieta.js
const { Schema, model, Types } = require("mongoose");

/**
 * Estructura:
 * - tipo "opciones": usa comidas
 * - tipo "calendario": usa diasSemana
 */

const CombinacionItemSchema = new Schema(
  {
    ingredienteId: { type: Types.ObjectId, ref: "Ingrediente" },
    nombre: { type: String },
    gramos: { type: Number },
    macros: {
      kcal: { type: Number, default: 0 },
      p: { type: Number, default: 0 },
      c: { type: Number, default: 0 },
      g: { type: Number, default: 0 },
    },
    notas: { type: String, default: "" },
  },
  { _id: false }
);

const OpcionSchema = new Schema(
  {
    tipo: {
      type: String,
      enum: ["ingrediente", "receta", "combinacion"],
      required: true,
    },

    ingredienteId: { type: Types.ObjectId, ref: "Ingrediente" },
    nombre: { type: String },
    gramos: { type: Number },
    unidades: { type: Number },

    recetaId: { type: Types.ObjectId, ref: "Receta" },

    items: { type: [CombinacionItemSchema], default: [] },

    macros: {
      kcal: { type: Number, default: 0 },
      p: { type: Number, default: 0 },
      c: { type: Number, default: 0 },
      g: { type: Number, default: 0 },
    },

    notas: { type: String, default: "" },
  },
  { _id: false }
);

const ComidaSchema = new Schema(
  {
    titulo: { type: String, required: true },
    hora: { type: String },
    opciones: { type: [OpcionSchema], default: [] },

    totales: {
      kcal: { type: Number, default: 0 },
      p: { type: Number, default: 0 },
      c: { type: Number, default: 0 },
      g: { type: Number, default: 0 },
    },

    notas: { type: String, default: "" },
  },
  { _id: false }
);

const DiaCalendarioSchema = new Schema(
  {
    dia: {
      type: String,
      enum: [
        "lunes",
        "martes",
        "miercoles",
        "miércoles",
        "jueves",
        "viernes",
        "sabado",
        "sábado",
        "domingo",
        "Lunes",
        "Martes",
        "Miércoles",
        "Miercoles",
        "Jueves",
        "Viernes",
        "Sábado",
        "Sabado",
        "Domingo",
      ],
      required: true,
    },
    comidas: { type: [ComidaSchema], default: [] },
    notas: { type: String, default: "" },

    totales: {
      kcal: { type: Number, default: 0 },
      p: { type: Number, default: 0 },
      c: { type: Number, default: 0 },
      g: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const DietaSchema = new Schema(
  {
    clienteId: {
      type: Types.ObjectId,
      ref: "Cliente",
      index: true,
      required: true,
    },

    asesorId: {
      type: Types.ObjectId,
      ref: "Usuario",
      index: true,
    },

    nombre: { type: String, default: "Dieta" },

    objetivo: {
      type: String,
      enum: ["ganancia", "perdida", "definicion", "salud", "rendimiento"],
      default: "salud",
    },

    estado: {
      type: String,
      enum: ["borrador", "publicada", "archivada"],
      default: "borrador",
      index: true,
    },

    macros: {
      kcal: { type: Number, default: 2000 },
      p: { type: Number, default: 120 },
      c: { type: Number, default: 200 },
      g: { type: Number, default: 70 },
    },

    tipo: {
      type: String,
      enum: ["opciones", "calendario"],
      default: "opciones",
    },

    comidas: { type: [ComidaSchema], default: [] },

    diasSemana: { type: [DiaCalendarioSchema], default: [] },

    notas: { type: String, default: "" },

    lineageId: { type: Types.ObjectId, ref: "Dieta" },
    rev: { type: Number, default: 1 },
    isCurrent: { type: Boolean, default: true },
    note: { type: String },
    restoredFrom: { type: Types.ObjectId, ref: "Dieta", default: null },
    supersededAt: { type: Date, default: null },
    supersededBy: { type: Types.ObjectId, ref: "Dieta", default: null },
    derivedFrom: { type: Types.ObjectId, ref: "Dieta", default: null },
  },
  { timestamps: true }
);

DietaSchema.pre("save", function (next) {
  if (!this.lineageId) this.lineageId = this._id;
  next();
});

DietaSchema.index({ lineageId: 1, rev: 1 }, { unique: true });
DietaSchema.index({ clienteId: 1, isCurrent: 1, createdAt: -1 });
DietaSchema.index({ asesorId: 1, clienteId: 1 });

module.exports = model("Dieta", DietaSchema);