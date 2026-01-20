const express = require('express');
const router = express.Router();
const Automation = require('../models/Automation');
const authMiddleware = require('../middlewares/authMiddleware');

// Get all automations for an advisor
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { advisorId } = req.query;
    const filter = {};
    if (advisorId) filter.advisorId = advisorId;
    
    const automations = await Automation.find(filter).populate('actions.templateId');
    res.json(automations);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create new automation
router.post('/', authMiddleware, async (req, res) => {
  try {
    const automation = new Automation(req.body);
    await automation.save();
    res.status(201).json(automation);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Update automation
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const automation = await Automation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(automation);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Delete automation
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await Automation.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Transfer automation to another advisor
router.post('/:id/transfer', authMiddleware, async (req, res) => {
  try {
    const { targetAdvisorId } = req.body;
    if (!targetAdvisorId) {
      return res.status(400).json({ error: 'targetAdvisorId is required' });
    }

    const automation = await Automation.findByIdAndUpdate(
      req.params.id, 
      { advisorId: targetAdvisorId }, 
      { new: true }
    );

    if (!automation) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    res.json(automation);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
