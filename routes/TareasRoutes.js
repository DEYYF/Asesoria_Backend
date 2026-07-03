// routes/tareaRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');

const mongoose = require('mongoose');
const Tarea = require('../models/Tarea');          
const { createTarea } = require('../utils/tareas'); 

function getAsesorId(req) {
  return req.user?._id || req.body?.asesorId || req.query?.asesorId || null;
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { status, assigneeId: queryAssigneeId, clientId } = req.query;
    const isSuperAdmin = req.user?.role === 'superadmin';

    // Enforcement: If not superadmin, must use own ID
    const effectiveAssigneeId = isSuperAdmin ? queryAssigneeId : req.user.id;

    const filter = {};
    if (status) filter.status = status;
    if (effectiveAssigneeId) filter.assigneeId = effectiveAssigneeId;
    if (clientId) filter.clientId = clientId;

    const tareas = await Tarea.find(filter)
      .populate("createdBy", "nombre")
      .populate("assigneeId", "nombre")
      .sort({ createdAt: -1 });
    res.json(tareas);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const tarea = await createTarea(req, req.body);
    res.status(201).json(tarea);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});


router.patch('/:id', async (req, res) => {
  try {
    const partial = { ...req.body };
    const asesorId = getAsesorId(req);
    if (asesorId) partial.updatedBy = asesorId;

    if (partial.status) {
      partial.statusChangedAt = new Date();
    }

    const tarea = await Tarea.findByIdAndUpdate(req.params.id, partial, { new: true })
      .populate("createdBy", "nombre")
      .populate("assigneeId", "nombre");
    if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });

    res.json(tarea);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});


router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'ID de tarea inválido' });
    }

    const filter = { _id: req.params.id };

    // Un asesor solo puede borrar sus propias tareas. Superadmin mantiene acceso global.
    if (req.user?.role !== 'superadmin') {
      filter.assigneeId = req.user.id;
    }

    const tarea = await Tarea.findOneAndDelete(filter);
    if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });

    return res.status(200).json({ ok: true, deletedId: req.params.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
