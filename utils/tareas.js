
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

/** Crear tarea asociada a una cita o manual */
async function createTarea(req, payload = {}) {
  // Prioritize payload.assigneeId (explicit) over req resolution
  const assigneeId =
    payload.assigneeId || payload.asesorId || resolveAsesorId(req);
  const createdBy = req.user?._id || req.user?.id;

  const tarea = await Tarea.create({
    assigneeId,
    createdBy,
    title: payload.title || "",
    notes: payload.notes || "",
    status: payload.status || "pending",
    dueAt: payload.dueAt || undefined,
    origin: payload.origin || "manual",
    clientId: payload.clientId || undefined,
    clientName: payload.clientName || undefined,
    metadata: { ...(payload.metadata || {}) },
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
