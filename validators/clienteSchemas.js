const { z } = require("zod");
const { objectId, dateISO, stringOpt, intOpt, boolOpt } = require("./common");

exports.createClienteBody = z.object({
  nombre: z.string().min(1),
  email: z.string().email().optional(),
  telefono: z.string().optional(),
  asesorId: objectId.optional(),
  Tarifa: stringOpt,
  Tiempo_Tarifa: z.enum(["1 Mes","3 Meses","6 Meses","12 Meses"]).optional(),
  fechaInicio: dateISO.optional(),
  fechaFin: dateISO.optional(),
  consentComms: boolOpt,
  preferContactChannel: z.enum(["email","whatsapp"]).optional(),
  segments: z.array(z.string()).optional(),
}).passthrough();

exports.updateClienteBody = exports.createClienteBody.partial();

exports.clienteIdParam = z.object({ id: objectId });

exports.actualizarTarifaBody = z.object({
  Tiempo_Tarifa: z.enum(["1 Mes","3 Meses","6 Meses","12 Meses"]),
}).passthrough();

exports.cambiarTarifaBody = z.object({
  Tarifa: z.string().min(1),
  Tiempo_Tarifa: z.enum(["1 Mes","3 Meses","6 Meses","12 Meses"]),
  fechaFin: dateISO,
}).passthrough();

exports.renovarTarifaBody = z.object({
  Tiempo_Tarifa: z.enum(["1 Mes","3 Meses","6 Meses","12 Meses"]),
  fechaFin: dateISO,
}).passthrough();

exports.historialProgresoBody = z.object({
  fecha: dateISO.optional(),
  notas: z.string().optional(),
  peso: z.number().optional(),
  grasa: z.number().optional(),
}).passthrough();

exports.destacadosQuery = z.object({
  asesorId: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  cutoffDays: z.coerce.number().int().min(1).max(60).default(3),
  segments: z.union([z.string(), z.array(z.string())]).optional(),
}).passthrough();
