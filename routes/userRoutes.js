const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/perfil', authMiddleware, (req, res) => {
  res.json({ mensaje: 'Perfil accedido con éxito', user: req.user });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json(req.user);
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

// Update calendar settings
router.put('/:id/calendar-settings', authMiddleware, async (req, res) => {
  try {
    const Usuario = require('../models/Usuario');
    const { bloques, workHours, vacationDays } = req.body;
    
    const user = await Usuario.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          'calendarSettings.bloques': bloques || [],
          'calendarSettings.workHours': workHours || { startHour: 7, endHour: 22 },
          'calendarSettings.vacationDays': vacationDays || []
        }
      },
      { new: true, runValidators: true }
    ).select('calendarSettings');
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(user.calendarSettings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
