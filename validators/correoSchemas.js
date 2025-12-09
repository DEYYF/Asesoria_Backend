const { z } = require("zod");

exports.sendCorreoBody = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(),
}).refine(d => d.html || d.text, { message: "html o text requerido" }).passthrough();
