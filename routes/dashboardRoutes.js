const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const Cliente = require('../models/Cliente');
const Dieta = require('../models/Dieta');
const Movimiento = require('../models/Movimiento');
const Entrenamiento = require('../models/Entrenamiento')

// Total clientes del asesor
router.get('/clientes', auth, async (req, res) => {
  const total = await Cliente.countDocuments({ asesorId: req.user._id });
  res.json({ total });
});

// Total dietas del asesor
router.get('/dietas', auth, async (req, res) => {
  const total = await Dieta.countDocuments({ asesorid: req.user._id });
  res.json({ total });
});

// Última dieta del asesor
router.get('/ultima', auth, async (req, res) => {
  const ultima = await Dieta.findOne({ asesorid: req.user._id })
  .sort({ createdAt: -1, _id: -1 })
  .lean();
  res.json(ultima || {});
});

//Ultimo Entrenamiento del asesor
router.get('/ultima/entr', auth, async (req, res) => {
  const { asesorid } = req.params

  try {
    const ultima = await Entrenamiento.findOne({ asesorid: asesorid })
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    if (!ultima) return res.json({});

    res.json({
      _id: ultima._id, // id del entrenamiento
      titulo: ultima.titulo,
      objetivo: ultima.objetivo,
      createdAt: ultima.createdAt,
      updatedAt: ultima.updatedAt,
      clienteId: ultima.clienteId?._id || ultima.clienteId,
    });
  } catch (err) {
    console.error("Error obteniendo última entr:", err);
    res.status(500).json({ error: "Error obteniendo último entrenamiento" });
  }
});

// Últimos movimientos
router.get('/movimientos', auth, async (req, res) => {
  const movimientos = await Movimiento.find({ asesorId: req.user._id }).sort({ fecha: -1 }).limit(10);
  res.json(movimientos);
});

module.exports = router;
