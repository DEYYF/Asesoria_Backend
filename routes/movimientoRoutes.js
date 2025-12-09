const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const Movimiento = require('../models/Movimiento');
const mongoose = require('mongoose');

router.get('/ultimos', auth, async (req, res) => {
  try {
    // page/limit
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const skip = (page - 1) * limit;

    // asesorId: del token o query
    const rawId = req.user?._id || req.user?.id || req.query?.asesorId || null;

    // filtro base
    const q = {};
    if (rawId) {
      // Intenta castear a ObjectId; si falla, usa string
      try {
        q.asesorId = new mongoose.Types.ObjectId(String(rawId));
      } catch {
        q.asesorId = String(rawId);
      }
    }

    // filtro opcional por tipo
    if (req.query.tipo) {
      q.tipo = String(req.query.tipo).toUpperCase(); // CREAR/EDITAR/BORRAR/PROGRESO
    }

    // consulta + total en paralelo
    const [items, total] = await Promise.all([
      Movimiento.find(q)
        .sort({ fecha: -1 })               // más recientes primero
        .skip(skip)
        .limit(limit)
        .select('mensaje descripcion fecha tipo refId clienteId') // proyección ligera
        .lean(),
      Movimiento.countDocuments(q),
    ]);

    res.json({
      items,
      total,
      page,
      limit,
    });
  } catch (e) {
    console.error('GET /movimientos/ultimos', e);
    res.status(500).json({ message: 'No se pudo cargar la actividad' });
  }
});

// Crear un nuevo movimiento
router.post('/', auth, async (req, res) => {
  const { asesorId, descripcion } = req.body;
  const movimiento = new Movimiento({
    asesorId: asesorId,
    descripcion,
    fecha : new Date()
  });
  
  try {
    await movimiento.save();
    res.status(201).json(movimiento);
  } catch (error) {
    res.status(400).json({ error: 'Error al crear el movimiento' });
  }
})

module.exports = router;
