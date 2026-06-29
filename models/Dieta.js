// models/Dieta.js
const { Schema, model, Types } = require("mongoose");

/**
 * Estructura:
 * - opciones por comida:
 *   - ingrediente  -> referencia a Ingrediente + snapshot
 *   - receta       -> referencia a Receta + snapshot
 *   - combinacion  -> ARRAY de ingredientes (no existe modelo Combinacion)
 *                      cada item con ingredienteId/nombre/gramos/macros
 *                      y la opción guarda macros totales (snapshot)
 */

const CombinacionItemSchema = new Schema(
  {
    ingredienteId: { type: Types.ObjectId, ref: "Ingrediente" },
    nombre: { type: String },     // denormalizado para snapshot
    gramos: { type: Number },     // cantidad en gramos
    // macros del item
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
    tipo: { type: String, enum: ["ingrediente", "receta", "combinacion"], required: true },

    // INGREDIENTE
    ingredienteId: { type: Types.ObjectId, ref: "Ingrediente" },
    nombre: { type: String },   // denormalizado para snapshot
    gramos: { type: Number },   // si aplica
    unidades: { type: Number }, // si aplica

    // RECETA
    recetaId: { type: Types.ObjectId, ref: "Receta" },

    // COMBINACION (NO hay modelo Combinacion)
    items: { type: [CombinacionItemSchema], default: [] }, // solo cuando tipo==="combinacion"

    // Macros de la Opción (snapshot total para esta opción)
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
    titulo: { type: String, required: true },  // p. ej., "Desayuno"
    hora: { type: String },                    // "08:00" (opcional)
    opciones: { type: [OpcionSchema], default: [] },

    // Totales por comida (snapshot del cálculo)
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

// Schema para un día del calendario
const DiaCalendarioSchema = new Schema(
  {
    dia: {
      type: String,
      enum: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
      required: true,
    },
    comidas: { type: [ComidaSchema], default: [] },
  },
  { _id: false }
);

const DietaSchema = new Schema(
  {
    // Contexto
    clienteId: { type: Types.ObjectId, ref: "Cliente", index: true, required: true },
    asesorId: { type: Types.ObjectId, ref: "Usuario", index: true },
    nombre: { type: String, default: "Dieta" },
    objetivo: { type: String, enum: ["ganancia", "perdida", "definicion", "salud", "rendimiento"], default: "salud" },
    estado: { type: String, enum: ["borrador", "publicada", "archivada"], default: "borrador", index: true },

    // Totales globales
    macros: {
      kcal: { type: Number, default: 2000 },
      p:   { type: Number, default: 120 },
      c:   { type: Number, default: 200 },
      g:   { type: Number, default: 70 },
    },

    tipo: { type: String, enum: ['opciones', 'calendario'], default: 'opciones' },

    // Estructura de comidas (para tipo === 'opciones')
    comidas: { type: [ComidaSchema], default: [] },

    // Estructura por días (para tipo === 'calendario')
    diasSemana: { type: [DiaCalendarioSchema], default: [] },

    notas: { type: String, default: "" },

    // -------- Versionado --------
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

// lineageId autodefault
DietaSchema.pre("save", function (next) {
  if (!this.lineageId) this.lineageId = this._id;
  next();
});

// Índices
DietaSchema.index({ lineageId: 1, rev: 1 }, { unique: true });
DietaSchema.index({ clienteId: 1, isCurrent: 1, createdAt: -1 });
DietaSchema.index({ asesorId: 1, clienteId: 1 });

module.exports = model("Dieta", DietaSchema);
