const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'superadmin';
    if (!isSuperAdmin) return res.status(403).json({ error: 'Acceso denegado' });

    const Usuario = require('../models/Usuario');
    // Include users with 'advisor' role OR no role field at all
    const users = await Usuario.find({ 
      $or: [
        { role: 'advisor' },
        { role: { $exists: false } },
        { role: null }
      ]
    }).select('nombre email avatarUrl role');
    
    // Normalize role for frontend
    const mappedUsers = users.map(u => {
      const userObj = u.toObject();
      if (!userObj.role) userObj.role = 'advisor';
      return userObj;
    });
    
    res.json(mappedUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    const user = await Usuario.findById(req.user.id).select('settings');
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
      req.user.id,
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

// Update calendar settings
router.put('/:id/calendar-settings', authMiddleware, async (req, res) => {
  try {
    const Usuario = require('../models/Usuario');
    const user = await Usuario.findByIdAndUpdate(
      req.params.id,
      { $set: { calendarSettings: req.body } },
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
      signatureImageUrl: '',
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

// --- SUPER ADMIN USER MANAGEMENT ---

// GET /api/users/:id - Get full user details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'superadmin';
    if (!isSuperAdmin) return res.status(403).json({ error: 'Acceso denegado' });

    const Usuario = require('../models/Usuario');
    const user = await Usuario.findById(req.params.id); // Don't exclude password for superadmin
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    const result = user.toObject();
    if (!result.role) result.role = 'advisor';
    // Keep password in response for superadmin to view/edit
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id/stats - Get advisor statistics
router.get('/:id/stats', authMiddleware, async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'superadmin';
    if (!isSuperAdmin) return res.status(403).json({ error: 'Acceso denegado' });

    const Cliente = require('../models/Cliente');
    const Cita = require('../models/Cita');
    const Tarea = require('../models/Tarea');

    const asesorId = req.params.id;

    const [clientCount, appointmentCount, taskCount] = await Promise.all([
      Cliente.countDocuments({ asesorId }),
      Cita.countDocuments({ asesorId }),
      Tarea.countDocuments({ assigneeId: asesorId })
    ]);

    res.json({
      clients: clientCount,
      appointments: appointmentCount,
      tasks: taskCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users - Create new user
router.post('/', authMiddleware, async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'superadmin';
    if (!isSuperAdmin) return res.status(403).json({ error: 'Acceso denegado' });

    const { nombre, email, password, role } = req.body;
    const Usuario = require('../models/Usuario');
    const bcrypt = require('bcrypt');

    const exists = await Usuario.findOne({ email });
    if (exists) return res.status(400).json({ error: 'El email ya está registrado' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new Usuario({
      nombre,
      email,
      password: hashedPassword,
      role: role || 'advisor'
    });

    await newUser.save();
    const result = newUser.toObject();
    delete result.password;
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id - Update user (all data)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'superadmin';
    if (!isSuperAdmin) return res.status(403).json({ error: 'Acceso denegado' });

    const { nombre, email, password, role, settings, calendarSettings } = req.body;
    const Usuario = require('../models/Usuario');
    const bcrypt = require('bcrypt');

    const updateData = { nombre, email, role, settings, calendarSettings };
    if (password && password.trim().length > 0) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Remove undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const user = await Usuario.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'superadmin';
    if (!isSuperAdmin) return res.status(403).json({ error: 'Acceso denegado' });

    const Usuario = require('../models/Usuario');
    const user = await Usuario.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true, mensaje: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/transfer-data - Bulk transfer data between advisors
router.post('/transfer-data', authMiddleware, async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'superadmin';
    if (!isSuperAdmin) return res.status(403).json({ error: 'Acceso denegado' });

    const { fromAdvisorId, toAdvisorId, modules } = req.body;
    
    if (!fromAdvisorId || !toAdvisorId) {
      return res.status(400).json({ error: 'Se requieren ambos asesores (origen y destino)' });
    }

    if (!modules || !Array.isArray(modules) || modules.length === 0) {
      return res.status(400).json({ error: 'Debe seleccionar al menos un módulo para transferir' });
    }

    const Usuario = require('../models/Usuario');
    const fromAdvisor = await Usuario.findById(fromAdvisorId);
    const toAdvisor = await Usuario.findById(toAdvisorId);

    if (!fromAdvisor || !toAdvisor) {
      return res.status(404).json({ error: 'Uno o ambos asesores no existen' });
    }

    const results = {};

    // 1. Clients (asesorId)
    if (modules.includes('clients')) {
      const Cliente = require('../models/Cliente');
      const updateRes = await Cliente.updateMany(
        { asesorId: fromAdvisorId },
        { $set: { asesorId: toAdvisorId } }
      );
      results.clients = updateRes.modifiedCount;
    }

    // 2. Automations (advisorId)
    if (modules.includes('automations')) {
      const Automation = require('../models/Automation');
      const updateRes = await Automation.updateMany(
        { advisorId: fromAdvisorId },
        { $set: { advisorId: toAdvisorId } }
      );
      results.automations = updateRes.modifiedCount;
    }

    // 3. Tasks (assigneeId)
    if (modules.includes('tasks')) {
      const Tarea = require('../models/Tarea');
      const updateRes = await Tarea.updateMany(
        { assigneeId: fromAdvisorId },
        { $set: { assigneeId: toAdvisorId } }
      );
      results.tasks = updateRes.modifiedCount;
    }

    // 4. Budgets (usuarioId)
    if (modules.includes('budgets')) {
      const Presupuesto = require('../models/Presuspuesto'); // Note spelling specific to project
      const updateRes = await Presupuesto.updateMany(
        { usuarioId: fromAdvisorId },
        { $set: { usuarioId: toAdvisorId } }
      );
      results.budgets = updateRes.modifiedCount;
    }

    // 5. Finance Movements (asesorId)
    if (modules.includes('finance')) {
      const Movimiento = require('../models/Movimiento');
      const updateRes = await Movimiento.updateMany(
        { asesorId: fromAdvisorId },
        { $set: { asesorId: toAdvisorId } }
      );
      results.finance = updateRes.modifiedCount;
    }

    // 6. Appointments (asesorId)
    if (modules.includes('appointments')) {
      const Cita = require('../models/Cita');
      const updateRes = await Cita.updateMany(
        { asesorId: fromAdvisorId },
        { $set: { asesorId: toAdvisorId } }
      );
      results.appointments = updateRes.modifiedCount;
    }

    res.json({ 
      ok: true, 
      mensaje: 'Transferencia completada correctamente',
      detalles: results
    });

  } catch (err) {
    console.error('Error en transferencia:', err);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
