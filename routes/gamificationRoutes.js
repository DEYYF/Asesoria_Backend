const express = require('express');
const router = express.Router();
const Cliente = require('../models/Cliente');
const authMiddleware = require('../middlewares/authMiddleware');
const { LEVELS } = require('../utils/gamificationManager');

// Get Leaderboard (Top 10 by Points)
// Optional: Filter by advisorId
router.get('/leaderboard', authMiddleware, async (req, res) => {
    try {
        const { advisorId } = req.query;
        
        let query = { 'gamification.points': { $gt: 0 }, estado: 'Activo' };
        if (advisorId) {
            query.asesorId = advisorId;
        }

        const clients = await Cliente.find(query)
            .sort({ 'gamification.points': -1 })
            .limit(10)
            .select('nombre apellido gamification asesorId');

        // Anonymize names: "Juan Pérez" -> "Juan P."
        const leaderboard = clients.map(c => {
            const parts = (c.nombre || "").split(" ");
            const firstName = parts[0];
            const initial = parts.length > 1 ? parts[1][0] + "." : "";
            
            return {
                _id: c._id,
                name: `${firstName} ${initial}`,
                points: c.gamification.points,
                level: c.gamification.level,
                streak: c.gamification.currentStreak
            };
        });

        res.json(leaderboard);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Stats for a specific client
router.get('/stats/:clientId', authMiddleware, async (req, res) => {
    try {
        const cliente = await Cliente.findById(req.params.clientId).select('gamification');
        if (!cliente) return res.status(404).json({ error: 'Cliente check failed' });

        const stats = {
            points: cliente.gamification.points,
            level: cliente.gamification.level,
            levelName: LEVELS.find(l => l.level === cliente.gamification.level)?.name,
            streak: cliente.gamification.currentStreak,
            history: cliente.gamification.history,
            nextLevelPoints: LEVELS.find(l => l.level === cliente.gamification.level + 1)?.minPoints
        };

        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
