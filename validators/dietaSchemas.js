// validators/dietaSchemas.js
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

const diaSemanaZ = z.object({
  dia: z.enum([
    'lunes',
    'martes',
    'miercoles',
    'miércoles',
    'jueves',
    'viernes',
    'sabado',
    'sábado',
    'domingo',
    'Lunes',
    'Martes',
    'Miercoles',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sabado',
    'Sábado',
    'Domingo',
  ]),
  comidas: z.array(comidaZ).default([]),
  notas: z.string().optional(),
  totales: macrosZ.partial().default({}),
});

const baseDietaZ = z.object({
  clienteId: z.string().min(1),
  asesorId: z.string().optional(),
  nombre: z.string().optional(),
  objetivo: z.enum(['ganancia', 'perdida', 'definicion', 'salud', 'rendimiento']).optional(),
  estado: z.enum(['borrador', 'publicada', 'archivada']).optional(),
  tipo: z.enum(['opciones', 'calendario']).default('opciones'),
  macros: macrosZ.partial().default({}),
  comidas: z.array(comidaZ).default([]),
  diasSemana: z.array(diaSemanaZ).default([]),
  notas: z.string().optional(),
});

const createDietaSchema = baseDietaZ;
const updateDietaSchema = baseDietaZ;

const createRevisionSchema = z.object({
  changes: z.record(z.any()).optional(),
  note: z.string().max(500).optional(),
});

const restoreRevisionSchema = z.object({
  note: z.string().max(500).optional(),
});

const copyDaySchema = z.object({
  from: z.string().min(1),
  to: z.array(z.string().min(1)).min(1),
  note: z.string().max(500).optional(),
});

module.exports = {
  createDietaSchema,
  updateDietaSchema,
  createRevisionSchema,
  restoreRevisionSchema,
  copyDaySchema,
};
