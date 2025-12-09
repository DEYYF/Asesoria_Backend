const { z } = require("zod");

exports.loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
}).passthrough();

exports.registerBody = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin","asesor","colaborador"]).optional(),
}).passthrough();
