const { z } = require("zod");
const { objectId, emailOpt } = require("./common");

exports.createUserBody = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin","asesor","colaborador"]).default("asesor"),
}).passthrough();

exports.updateUserBody = z.object({
  nombre: z.string().min(1).optional(),
  email: emailOpt,
  role: z.enum(["admin","asesor","colaborador"]).optional(),
}).passthrough();

exports.userIdParam = z.object({ id: objectId });
