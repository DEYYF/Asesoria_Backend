// controllers/dietasController.js
const mongoose = require("mongoose");
const Dieta = require("../models/Dieta");
const { calculateDietMacros } = require("../utils/dietMacrosCalculator");

/** Util: limpiar campos de versionado del payload entrante */
function stripVersioning(input = {}) {
  const o = { ...input };
  delete o._id;
  delete o.lineageId;
  delete o.rev;
  delete o.isCurrent;
  delete o.note; // la nota de revisión se envía aparte
  delete o.restoredFrom;
  delete o.supersededAt;
  delete o.supersededBy;
  delete o.derivedFrom;
  delete o.createdAt;
  delete o.updatedAt;
  return o;
}

/** GET /api/dietas */
exports.list = async (req, res) => {
  const { clienteId, asesorId, isCurrent = "true" } = req.query;
  const q = {};
  if (clienteId) q.clienteId = clienteId;
  if (asesorId) q.asesorId = asesorId;
  if (isCurrent !== "all") q.isCurrent = isCurrent === "true";
  
  // Exclude archived diets by default
  q.estado = { $ne: "archivada" };

  const items = await Dieta.find(q).sort({ createdAt: -1 }).lean();
  res.json(items);
};

/** POST /api/dietas */
exports.create = async (req, res) => {
  try {
    let payload = stripVersioning(req.validatedBody || req.body);
    
    // Calculate macros before creating
    payload = await calculateDietMacros(payload);
    
    const doc = await Dieta.create(payload);
    
    // Automation: DIET_ASSIGNED
    if (doc.asesorId && doc.clienteId) {
       const { triggerAutomations } = require("../utils/automationManager");
       await triggerAutomations('DIET_ASSIGNED', {
          advisorId: doc.asesorId,
          clientId: doc.clienteId,
          data: { dietId: doc._id }
       });
    }

    return res.status(201).json(doc);
  } catch (e) {
    console.error("Error creating diet:", e);
    return res.status(400).json({ error: e.message });
  }
};

/** GET /api/dietas/:id */
exports.getById = async (req, res) => {
  const { id } = req.params;
  const doc = await Dieta.findById(id)
    .populate({
      path: "comidas.opciones.recetaId",
      populate: {
        path: "ingredientes.ingrediente",
        select: "nombre macros",
      },
    })
    .lean();
  if (!doc) return res.status(404).json({ error: "Dieta no encontrada" });
  return res.json(doc);
};

/** GET /api/dietas/:id/comidas (compat) */
exports.getComidas = async (req, res) => {
  const { id } = req.params;
  const doc = await Dieta.findById(id).select("comidas").lean();
  if (!doc) return res.status(404).json({ error: "Dieta no encontrada" });
  return res.json(doc.comidas || []);
};

/**
 * PUT /api/dietas/:id
 * Retrocompatible: NO sobreescribe. Crea nueva revisión con los cambios enviados.
 */
exports.putAsNewRevision = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;

    const base = await Dieta.findById(id).session(session);
    if (!base) throw new Error("Dieta no encontrada");

    const lineageId = base.lineageId || base._id;
    const last = await Dieta.findOne({ lineageId }).sort({ rev: -1 }).session(session);
    const nextRev = (last?.rev || 1) + 1;

    let incoming = stripVersioning(req.validatedBody || req.body);
    const noteFromBody = typeof (req.body?.note) === "string" ? req.body.note : null;

    const clone = base.toObject();
    delete clone._id;
    delete clone.createdAt;
    delete clone.updatedAt;

    // Merge clone with incoming changes to calculate full macros
    let mergedData = { ...clone, ...incoming };
    mergedData = await calculateDietMacros(mergedData);

    const nuevaData = {
      ...mergedData,
      lineageId,
      rev: nextRev,
      isCurrent: true,
      note: noteFromBody || "Edición guardada desde PUT",
      restoredFrom: null,
      supersededAt: null,
      supersededBy: null,
      derivedFrom: base.derivedFrom || null,
    };

    const [nueva] = await Dieta.create([nuevaData], { session });

    await Dieta.updateMany(
      { lineageId, _id: { $ne: nueva._id }, isCurrent: true },
      { $set: { isCurrent: false, supersededAt: new Date(), supersededBy: nueva._id } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    return res.status(200).json(nueva);
  } catch (e) {
    console.error("Error in putAsNewRevision:", e);
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ error: e.message });
  }
};

/** DELETE /api/dietas/:id (soft por defecto; hard si ?hard=1) */
exports.remove = async (req, res) => {
  const { id } = req.params;
  const { hard } = req.query;
  const doc = await Dieta.findById(id);
  if (!doc) return res.status(404).json({ error: "Dieta no encontrada" });

  if (hard === "1") {
    await Dieta.deleteOne({ _id: id });
    return res.json({ ok: true, deleted: id });
  } else {
    doc.estado = "archivada";
    await doc.save();
    return res.json({ ok: true, archived: id });
  }
};

/** GET /api/dietas/:id/revisions */
exports.listRevisions = async (req, res) => {
  const { id } = req.params;
  const base = await Dieta.findById(id).lean();
  if (!base) return res.status(404).json({ error: "Dieta no encontrada" });

  const lineageId = base.lineageId || base._id;
  const revisions = await Dieta.find({ lineageId })
    .select("_id rev isCurrent note restoredFrom createdAt updatedAt supersededAt supersededBy")
    .sort({ rev: -1 })
    .lean();

  return res.json({ lineageId, revisions });
};

/** POST /api/dietas/:id/revision */
exports.createRevision = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { changes = {}, note } = req.validatedBody || req.body;

    const base = await Dieta.findById(id).session(session);
    if (!base) throw new Error("Dieta no encontrada");

    const lineageId = base.lineageId || base._id;
    const last = await Dieta.findOne({ lineageId }).sort({ rev: -1 }).session(session);
    const nextRev = (last?.rev || 1) + 1;

    const clone = base.toObject();
    delete clone._id;
    delete clone.createdAt;
    delete clone.updatedAt;

    // Merge clone with changes to calculate full macros
    let mergedData = { ...clone, ...stripVersioning(changes) };
    mergedData = await calculateDietMacros(mergedData);

    const nueva = await Dieta.create(
      [{
        ...mergedData,
        lineageId,
        rev: nextRev,
        isCurrent: true,
        note: note || null,
        restoredFrom: null,
        supersededAt: null,
        supersededBy: null,
      }],
      { session }
    );

    await Dieta.updateMany(
      { lineageId, _id: { $ne: nueva[0]._id }, isCurrent: true },
      { $set: { isCurrent: false, supersededAt: new Date(), supersededBy: nueva[0]._id } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    return res.status(201).json({ ok: true, dieta: nueva[0] });
  } catch (e) {
    console.error("Error in createRevision:", e);
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ error: e.message });
  }
};

/** POST /api/dietas/:id/restore/:rev */
exports.restoreRevision = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id, rev } = req.params;
    const { note } = req.validatedBody || req.body;

    const base = await Dieta.findById(id).session(session);
    if (!base) throw new Error("Dieta no encontrada");

    const lineageId = base.lineageId || base._id;
    const target = await Dieta.findOne({ lineageId, rev: Number(rev) }).session(session);
    if (!target) throw new Error("Revisión objetivo no encontrada");

    const last = await Dieta.findOne({ lineageId }).sort({ rev: -1 }).session(session);
    const nextRev = (last?.rev || 1) + 1;

    const content = target.toObject();
    delete content._id;
    delete content.createdAt;
    delete content.updatedAt;

    const restored = await Dieta.create(
      [{
        ...content,
        lineageId,
        rev: nextRev,
        isCurrent: true,
        note: note || `Restaurada desde rev ${target.rev}`,
        restoredFrom: target._id,
        supersededAt: null,
        supersededBy: null,
      }],
      { session }
    );

    await Dieta.updateMany(
      { lineageId, _id: { $ne: restored[0]._id }, isCurrent: true },
      { $set: { isCurrent: false, supersededAt: new Date(), supersededBy: restored[0]._id } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    return res.status(201).json({ ok: true, dieta: restored[0] });
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ error: e.message });
  }
};

/** GET /api/dietas/cliente/:clienteId/ultima */
exports.getLastDietForClient = async (req, res) => {
  try {
    const { clienteId } = req.params;
    
    const lastDiet = await Dieta.findOne({ 
      clienteId,
      isCurrent: true,
      estado: { $ne: "archivada" }
    })
    .sort({ createdAt: -1 })
    .lean();
    
    if (!lastDiet) {
      return res.status(404).json({ error: "No diet found for this client" });
    }
    
    return res.json(lastDiet);
  } catch (e) {
    console.error("Error getting last diet:", e);
    return res.status(400).json({ error: e.message });
  }
};

/** GET /api/dietas/:id/shopping-list */
exports.getShoppingList = async (req, res) => {
  try {
    const { id } = req.params;
    const { periodo = 'diario' } = req.query;

    let multiplier = 1;
    if (periodo === 'semanal') multiplier = 7;
    else if (periodo === 'mensual') multiplier = 30;

    const doc = await Dieta.findById(id)
      .populate({
        path: "comidas.opciones.recetaId",
        populate: {
          path: "ingredientes.ingrediente",
          select: "nombre tipo",
        },
      })
      .populate("comidas.opciones.ingredienteId", "nombre tipo")
      .populate("comidas.opciones.items.ingredienteId", "nombre tipo")
      .lean();

    if (!doc) return res.status(404).json({ error: "Dieta no encontrada" });

    const ingredientsMap = {};

    doc.comidas.forEach(comida => {
      const numOptions = (comida.opciones && comida.opciones.length > 0) ? comida.opciones.length : 1;
      const optionMultiplier = multiplier / numOptions;

      comida.opciones.forEach(opcion => {
        if (opcion.tipo === 'ingrediente') {
            const ing = opcion.ingredienteId;
            const name = ing?.nombre || opcion.nombre;
            const grams = (opcion.gramos || 0) * optionMultiplier;
            const category = ing?.tipo || "General";
            
            _aggregate(ingredientsMap, name, grams, category);
        } else if (opcion.tipo === 'combinacion') {
            opcion.items.forEach(item => {
                const ing = item.ingredienteId;
                const name = ing?.nombre || item.nombre;
                const grams = (item.gramos || 0) * optionMultiplier;
                const category = ing?.tipo || "General";
                
                _aggregate(ingredientsMap, name, grams, category);
            });
        } else if (opcion.tipo === 'receta' && opcion.recetaId) {
            opcion.recetaId.ingredientes.forEach(ri => {
                const ing = ri.ingrediente;
                const name = ing?.nombre || "Ingrediente Desconocido";
                const grams = (ri.gramos || 0) * optionMultiplier;
                const category = ing?.tipo || "General";
                
                _aggregate(ingredientsMap, name, grams, category);
            });
        }
      });
    });

    const result = Object.values(ingredientsMap).sort((a, b) => a.category.localeCompare(b.category));
    res.json(result);
  } catch (e) {
    console.error("Error in getShoppingList:", e);
    res.status(500).json({ error: e.message });
  }
};

function _aggregate(map, name, grams, category) {
    if (!name) return;
    if (!map[name]) {
        map[name] = { name, grams: 0, category };
    }
    map[name].grams += grams;
}
