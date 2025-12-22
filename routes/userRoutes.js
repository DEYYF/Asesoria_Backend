const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/perfil', authMiddleware, (req, res) => {
  res.json({ mensaje: 'Perfil accedido con éxito', user: req.user });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// Get current user settings
router.get('/me/settings', authMiddleware, async (req, res) => {
  try {
    const Usuario = require('../models/Usuario');
    const user = await Usuario.findById(req.user._id).select('settings');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user.settings || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update current user settings
router.put('/me/settings', authMiddleware, async (req, res) => {
  try {
    const Usuario = require('../models/Usuario');
    const user = await Usuario.findByIdAndUpdate(
      req.user._id,
      { $set: { settings: req.body } },
      { new: true, runValidators: true }
    ).select('settings');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user.settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get calendar settings
router.get('/:id/calendar-settings', authMiddleware, async (req, res) => {
  try {
    const Usuario = require('../models/Usuario');
    const user = await Usuario.findById(req.params.id).select('calendarSettings');
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Return default values if not set
    const settings = user.calendarSettings || {
      bloques: [],
      workHours: { startHour: 7, endHour: 22 },
      vacationDays: []
    };
    
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get full user settings
router.get('/:id/settings', authMiddleware, async (req, res) => {
  try {
    const Usuario = require('../models/Usuario');
    const user = await Usuario.findById(req.params.id).select('settings');
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(user.settings || {
      pushNotifications: true,
      emailNotifications: true,
      theme: 'system',
      accentColor: '#007AFF',
      emailSignature: '',
      businessEmail: ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update full user settings
router.put('/:id/settings', authMiddleware, async (req, res) => {
  try {
    const Usuario = require('../models/Usuario');
    const user = await Usuario.findByIdAndUpdate(
      req.params.id,
      { $set: { settings: req.body } },
      { new: true, runValidators: true }
    ).select('settings');
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(user.settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
