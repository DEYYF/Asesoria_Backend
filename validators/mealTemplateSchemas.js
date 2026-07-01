const { z } = require('zod');

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
  tipo: z.enum(['ingrediente', 'receta', 'combinacion']),
  ingredienteId: z.string().optional(),
  nombre: z.string().optional(),
  gramos: z.number().optional(),
  unidades: z.number().optional(),
  recetaId: z.string().optional(),
  items: z.array(combinacionItemZ).default([]),
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

const createMealTemplateSchema = z.object({
  nombre: z.string().min(1).max(120),
  categoria: z.string().max(80).optional(),
  scope: z.enum(['global', 'personal']).optional(),
  comida: comidaZ,
});

const updateMealTemplateSchema = createMealTemplateSchema.partial().extend({
  comida: comidaZ.optional(),
});

module.exports = {
  createMealTemplateSchema,
  updateMealTemplateSchema,
};
