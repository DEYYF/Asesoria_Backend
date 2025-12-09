const { z } = require("zod");
const { objectId } = require("./common");

exports.createComidaBody = z.object({
  nombre: z.string().min(1),
  macros: z.any().optional(),
  asesorId: objectId.optional(),
}).passthrough();

exports.updateComidaBody = exports.createComidaBody.partial();
exports.comidaIdParam = z.object({ id: objectId });
