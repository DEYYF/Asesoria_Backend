// validators/dietaSchemas.js
const { z } = require("zod");

const macrosZ = z.object({
  kcal: z.number().nonnegative().default(0),
  p: z.number().nonnegative().default(0),
  c: z.number().nonnegative().default(0),
  g: z.number().nonnegative().default(0),
});

const combinacionItemZ = z.object({
  ingredienteId: z.string().optional(),
  nombre: z.string().optional(),
  gramos: z.number().optional(),
  macros: macrosZ.partial().default({}),
  notas: z.string().optional(),
});

const opcionZ = z.object({
  tipo: z.enum(["ingrediente", "receta", "combinacion"]),
  // ingrediente
  ingredienteId: z.string().optional(),
  nombre: z.string().optional(),
  gramos: z.number().optional(),
  unidades: z.number().optional(),
  // receta
  recetaId: z.string().optional(),
  // combinacion
  items: z.array(combinacionItemZ).optional(),
  // totales de la opción
  macros: macrosZ.partial().default({}),
  notas: z.string().optional(),
});

const comidaZ = z.object({
  titulo: z.string().min(1),
  hora: z.string().optional(),
  opciones: z.array(opcionZ).default([]),
  totales: macrosZ.partial().default({}),
  notas: z.string().optional(),
});

const baseDietaZ = z.object({
  clienteId: z.string().min(1),
  asesorId: z.string().optional(),
  nombre: z.string().optional(),
  objetivo: z.enum(["ganancia", "perdida", "definicion", "salud", "rendimiento"]).optional(),
  estado: z.enum(["borrador", "publicada", "archivada"]).optional(),
  macros: macrosZ.partial().default({}),
  comidas: z.array(comidaZ).default([]),
  notas: z.string().optional(),
});

const createDietaSchema = baseDietaZ;
const updateDietaSchema = baseDietaZ; // el PUT aplicará como nueva revisión

const createRevisionSchema = z.object({
  changes: z.record(z.any()).optional(),
  note: z.string().max(500).optional(),
});

const restoreRevisionSchema = z.object({
  note: z.string().max(500).optional(),
});

module.exports = {
  createDietaSchema,
  updateDietaSchema,
  createRevisionSchema,
  restoreRevisionSchema,
};
