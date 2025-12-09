const { z } = require("zod");
const { objectId, dateISO } = require("./common");

exports.attendanceQuery = z.object({
  from: dateISO.optional(),
  to: dateISO.optional(),
  asesorId: objectId.optional(),
  tz: z.string().optional(),
}).passthrough();

exports.renewalsQuery = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
}).passthrough();

exports.heatmapQuery = z.object({
  from: dateISO.optional(),
  to: dateISO.optional(),
  asesorId: objectId.optional(),
  tz: z.string().optional(),
}).passthrough();

exports.funnelQuery = z.object({
  asesorId: objectId.optional(),
}).passthrough();
