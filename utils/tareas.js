
const { Types } = require("mongoose");
const Tarea = require("../models/Tarea");

/** Resuelve asesorId desde req (user, body, query) */
function resolveAsesorId(req) {
  const raw =
    req?.user?._id ||
    req?.user?.id ||
    req?.body?.asesorId ||
    req?.query?.asesorId;
  if (!raw) return undefined;
  return Types.ObjectId.isValid(String(raw))
    ? new Types.ObjectId(String(raw))
    : String(raw);
}

/** Filtro para localizar la tarea ligada a una cita concreta */
function buildFilter(req, citaId) {
  const f = { origin: "cita", "metadata.citaId": String(citaId) };
  const aid = resolveAsesorId(req);
  if (aid) f.asesorId = aid;
  return f;
}

/** Crear tarea asociada a una cita */
async function createTarea(req, payload = {}) {
  const asesorId = resolveAsesorId(req);
  const tarea = await Tarea.create({
    asesorId,
    title: payload.title || "",
    notes: payload.notes || "",
    status: payload.status || "pending", // pending | done | canceled | ...
    dueAt: payload.dueAt || undefined,   // puede ser 'YYYY-MM-DD' o Date
    origin: payload.origin || "cita",
    clientId: payload.clientId || undefined,
    metadata: { ...(payload.metadata || {}) }, // { citaId, ... }
  });
  return tarea;
}

/** Actualiza la tarea ligada a una cita (por id de cita) */
async function updateTareaCita(req, citaId, data = {}) {
  
}

/** Borra la tarea ligada a una cita */
async function deleteTareaCita(citaId) {
  return Tarea.deleteOne(citaId);
}

/** Cambia el status de la tarea ligada a una cita */
async function setTareaStatusByCita(req, citaId, status) {
  const filter = buildFilter(req, citaId);
  return Tarea.findOneAndUpdate(filter, { $set: { status } }, { new: true });
}

module.exports = { createTarea, updateTareaCita, deleteTareaCita, setTareaStatusByCita };
