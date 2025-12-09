const { z } = require("zod");
const { objectId } = require("./common");

exports.createEjercicioBody = z.object({
  nombre: z.string().min(1),
  grupo: z.string().optional(),
  asesorId: objectId.optional(),
}).passthrough();

exports.updateEjercicioBody = exports.createEjercicioBody.partial();
exports.ejercicioIdParam = z.object({ id: objectId });
