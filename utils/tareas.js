
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
    status: payload.status || "todo", // Normalized to "todo"
    priority: payload.priority || "medium",
    dueAt: payload.dueAt || undefined,
    origin: payload.origin || "manual",
    clientId: payload.clientId || undefined,
    clientName: payload.clientName || undefined,
    subtasks: payload.subtasks || [],
    tags: payload.tags || [],
    attachments: payload.attachments || [],
    statusChangedAt: new Date(),
    metadata: { ...(payload.metadata || {}) },
  });
  return tarea;
}

/** Actualiza la tarea ligada a una cita (por id de cita) */
async function updateTareaCita(req, citaId, data = {}) {
  const filter = buildFilter(req, citaId);
  const update = { ...data };
  
  // If status is changed, update statusChangedAt
  if (update.status) {
    update.statusChangedAt = new Date();
  }

  return Tarea.findOneAndUpdate(filter, { $set: update }, { new: true });
}

/** Borra la tarea ligada a una cita */
async function deleteTareaCita(citaId) {
  // Use filter to ensure we delete the correct linked task
  const filter = { origin: "cita", "metadata.citaId": String(citaId) };
  return Tarea.deleteOne(filter);
}

/** Cambia el status de la tarea ligada a una cita */
async function setTareaStatusByCita(req, citaId, status) {
  const filter = buildFilter(req, citaId);
  return Tarea.findOneAndUpdate(
    filter, 
    { $set: { status, statusChangedAt: new Date() } }, 
    { new: true }
  );
}

module.exports = { createTarea, updateTareaCita, deleteTareaCita, setTareaStatusByCita };
