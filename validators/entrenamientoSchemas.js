const { z } = require("zod");
const { objectId } = require("./common");

exports.createEntrenamientoBody = z.object({
  clienteId: objectId,
  asesorId: objectId.optional(),
  titulo: z.string().min(1).optional(),
}).passthrough();

exports.updateEntrenamientoBody = exports.createEntrenamientoBody.partial();
exports.entrenamientoIdParam = z.object({ id: objectId });
