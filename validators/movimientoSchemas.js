const { z } = require("zod");
const { objectId } = require("./common");

exports.createMovimientoBody = z.object({
  asesorId: objectId.optional(),
  tipo: z.string().min(1),
  mensaje: z.string().min(1),
  meta: z.any().optional(),
}).passthrough();
