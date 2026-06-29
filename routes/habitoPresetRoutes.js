const express = require('express');
const router = express.Router();
const HabitoPreset = require('../models/HabitoPreset');
const authMiddleware = require('../middlewares/authMiddleware');

// @route   GET /api/presets/habitos
// @desc    Get all active habit presets
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { categoria } = req.query;
    const query = { activo: true };
    
    if (categoria) {
      query.categoria = categoria;
    }

    const presets = await HabitoPreset.find(query).sort({ categoria: 1, orden: 1 });
    res.json(presets);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/presets/habitos
// @desc    Create a new habit preset (Advisors only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    // Optional: Add role check here if only certain users can create presets
    const { nombre, descripcion, tipo, unidad, target, categoria, icono, orden } = req.body;

    const newPreset = new HabitoPreset({
      nombre,
      descripcion,
      tipo,
      unidad,
      target,
      categoria,
      icono,
      orden
    });

    const preset = await newPreset.save();
    res.json(preset);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/presets/habitos/:id
// @desc    Update a habit preset
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const preset = await HabitoPreset.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!preset) return res.status(404).json({ msg: 'Preset not found' });
    res.json(preset);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/presets/habitos/:id
// @desc    Delete a habit preset (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const preset = await HabitoPreset.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    );
    if (!preset) return res.status(404).json({ msg: 'Preset not found' });
    res.json({ msg: 'Preset deactivated' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
