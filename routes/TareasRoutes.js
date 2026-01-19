// routes/tareaRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');

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

    const tareas = await Tarea.find(filter).sort({ createdAt: -1 });
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

    const tarea = await Tarea.findByIdAndUpdate(req.params.id, partial, { new: true });
    if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });

    res.json(tarea);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});


router.delete('/:id', async (req, res) => {
  try {
    const tarea = await Tarea.findByIdAndDelete(req.params.id);
    if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
