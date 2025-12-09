const { z } = require("zod");
const { objectId, dateISO, timeHHmm } = require("./common");

exports.createCitaBody = z.object({
  asesorId: objectId,
  clienteId: objectId,
  title: z.string().min(1),
  date: dateISO,
  hora: timeHHmm,
  horaFin: timeHHmm.optional(),
  color: z.string().optional(),
}).passthrough();

exports.updateCitaBody = z.object({
  title: z.string().min(1).optional(),
  date: dateISO.optional(),
  hora: timeHHmm.optional(),
  horaFin: timeHHmm.optional(),
  color: z.string().optional(),
}).passthrough();

exports.citaIdParam = z.object({ id: objectId });

exports.bySlotQuery = z.object({
  from: dateISO,
  to: dateISO,
  weekday: z.coerce.number().int().min(0).max(6),
  startHour: z.coerce.number().int().min(0).max(23).default(0),
  endHour: z.coerce.number().int().min(1).max(24).default(24),
  asesorId: objectId.optional(),
  tz: z.string().optional(),
}).passthrough();
