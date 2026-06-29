const express = require('express');
const router = express.Router();
const Habito = require('../models/Habito');
const HabitoRegistro = require('../models/HabitoRegistro');
const authMiddleware = require('../middlewares/authMiddleware');
const { 
  updateGamificationStats, 
  awardXP, 
  calculateHabitXP,
  updateChallengeProgress 
} = require('../services/gamificationService');

// @route   GET /api/habitos
// @desc    Get all habits for a client
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { clienteId } = req.query;
    if (!clienteId) return res.status(400).json({ msg: 'clienteId is required' });

    const habitos = await Habito.find({ clienteId, activo: true }).sort({ orden: 1 });
    res.json(habitos);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/habitos
// @desc    Create a new habit
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { nombre, descripcion, tipo, unidad, target, frecuencia, clienteId, asesorId, orden } = req.body;

    const newHabito = new Habito({
      nombre,
      descripcion,
      tipo,
      unidad,
      target,
      frecuencia,
      clienteId,
      asesorId,
      orden
    });

    const habito = await newHabito.save();
    res.json(habito);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/habitos/logs
// @desc    Get habit logs for a client with range and filters
router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const { clienteId, startDate, endDate, habitoId, month, year } = req.query;
    if (!clienteId) return res.status(400).json({ msg: 'clienteId is required' });

    const query = { clienteId };
    
    // Support date range
    if (startDate && endDate) {
      query.fecha = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } 
    // Support month/year filtering
    else if (month || year) {
      const y = parseInt(year) || new Date().getFullYear();
      if (month) {
        const m = parseInt(month) - 1; // JS months are 0-11
        query.fecha = {
          $gte: new Date(y, m, 1),
          $lte: new Date(y, m + 1, 0, 23, 59, 59)
        };
      } else {
        query.fecha = {
          $gte: new Date(y, 0, 1),
          $lte: new Date(y, 11, 31, 23, 59, 59)
        };
      }
    }

    if (habitoId) {
      query.habitoId = habitoId;
    }

    const logs = await HabitoRegistro.find(query).sort({ fecha: -1 });
    res.json(logs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/habitos/:id
// @desc    Update a habit
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const habito = await Habito.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!habito) return res.status(404).json({ msg: 'Habito not found' });
    res.json(habito);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/habitos/:id
// @desc    Delete (soft or hard) a habit
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const habito = await Habito.findByIdAndDelete(req.params.id);
    if (!habito) return res.status(404).json({ msg: 'Habito not found' });
    // Also cleanup logs if needed (optional, or just leave them as archive)
    // await HabitoRegistro.deleteMany({ habitoId: req.params.id });
    res.json({ msg: 'Habito removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/habitos/logs
// @desc    Upsert a daily habit log
router.post('/logs', authMiddleware, async (req, res) => {
  try {
    const { habitoId, clienteId, fecha, completado, valor, notas } = req.body;

    const normalizedDate = new Date(fecha);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const log = await HabitoRegistro.findOneAndUpdate(
      { habitoId, clienteId, fecha: normalizedDate },
      { completado, valor, notas },
      { new: true, upsert: true }
    );

    // Gamification Integration
    if (completado || (valor !== null && valor !== undefined)) {
      // 1. Update streaks and general stats
      const stats = await updateGamificationStats(clienteId);
      
      // 2. Award XP for the habit
      const xpAmount = calculateHabitXP(stats?.currentStreak || 0);
      await awardXP(clienteId, xpAmount, 'HABIT_COMPLETE');
      
      // 3. Update active challenges
      await updateChallengeProgress(clienteId, habitoId);
    }

    res.json(log);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
