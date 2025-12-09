// validators/common.js
const { z } = require("zod");

exports.objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId inválido");
exports.dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha YYYY-MM-DD");
exports.timeHHmm = z.string().regex(/^\d{1,2}:\d{2}$/, "Hora HH:mm");
exports.emailOpt = z.string().email().optional();
exports.boolOpt = z.coerce.boolean().optional();
exports.intOpt = z.coerce.number().int().optional();
exports.stringOpt = z.string().optional();
