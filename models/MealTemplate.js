const { Schema, model, Types } = require('mongoose');

const MacrosSchema = new Schema(
  {
    kcal: { type: Number, default: 0 },
    p: { type: Number, default: 0 },
    c: { type: Number, default: 0 },
    g: { type: Number, default: 0 },
  },
  { _id: false }
);

const CombinacionItemSchema = new Schema(
  {
    ingredienteId: { type: Types.ObjectId, ref: 'Ingrediente' },
    nombre: { type: String },
    gramos: { type: Number },
    macros: { type: MacrosSchema, default: () => ({}) },
    notas: { type: String, default: '' },
  },
  { _id: false }
);

const OpcionSchema = new Schema(
  {
    tipo: {
      type: String,
      enum: ['ingrediente', 'receta', 'combinacion'],
      required: true,
    },
    ingredienteId: { type: Types.ObjectId, ref: 'Ingrediente' },
    nombre: { type: String },
    gramos: { type: Number },
    unidades: { type: Number },
    recetaId: { type: Types.ObjectId, ref: 'Receta' },
    items: { type: [CombinacionItemSchema], default: [] },
    macros: { type: MacrosSchema, default: () => ({}) },
    notas: { type: String, default: '' },
  },
  { _id: false }
);

const ComidaSchema = new Schema(
  {
    titulo: { type: String, required: true },
    hora: { type: String, default: '' },
    opciones: { type: [OpcionSchema], default: [] },
    totales: { type: MacrosSchema, default: () => ({}) },
    notas: { type: String, default: '' },
  },
  { _id: false }
);

const MealTemplateSchema = new Schema(
  {
    asesorId: {
      type: Types.ObjectId,
      ref: 'Usuario',
      required: true,
      index: true,
    },
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    categoria: {
      type: String,
      default: 'General',
      trim: true,
    },
    comida: {
      type: ComidaSchema,
      required: true,
    },
  },
  { timestamps: true }
);

MealTemplateSchema.index({ asesorId: 1, nombre: 1 });

module.exports = model('MealTemplate', MealTemplateSchema);
