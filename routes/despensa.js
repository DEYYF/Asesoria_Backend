const express = require('express');
const router = express.Router();
const Despensa = require('../models/Despensa');

// GET /api/despensa/:clienteId
router.get('/:clienteId', async (req, res) => {
  try {
    const items = await Despensa.find({ clienteId: req.params.clienteId });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/despensa (upsert)
router.post('/', async (req, res) => {
  try {
    const { clienteId, nombreIngrediente, cantidad, unidad, categoria } = req.body;
    const item = await Despensa.findOneAndUpdate(
      { clienteId, nombreIngrediente },
      { cantidad, unidad, categoria, ultimaActualizacion: new Date() },
      { upsert: true, new: true }
    );
    res.json(item);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/despensa/:id
router.delete('/:id', async (req, res) => {
  try {
    await Despensa.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
