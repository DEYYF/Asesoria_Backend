const express = require('express');
const router = express.Router();
const { analyzeStall, suggestMacroAdjustment, analyzeWorkoutProgression } = require('../utils/intelligenceManager');
const EntrenamientoRegistro = require('../models/EntrenamientoRegistro');

/**
 * Get intelligent insights for a specific client
 */
router.get('/insights/:clientId', async (req, res) => {
    try {
        const { clientId } = req.params;

        // 1. Check for weight stall
        const stall = await analyzeStall(clientId);

        // 2. Suggest macro adjustments if stalled
        const macroAdjustment = await suggestMacroAdjustment(clientId);

        // 3. Get latest workout progression suggestions
        const latestWorkout = await EntrenamientoRegistro.findOne({ clienteId: clientId }).sort({ fecha: -1 });
        let workoutSuggestions = [];
        if (latestWorkout) {
            workoutSuggestions = await analyzeWorkoutProgression(latestWorkout._id);
        }

        res.json({
            stall,
            macroAdjustment,
            workoutSuggestions,
            hasInsights: !!stall || !!macroAdjustment || workoutSuggestions.length > 0
        });
    } catch (error) {
        console.error('Error fetching smart insights:', error);
        res.status(500).json({ error: 'Error fetching smart insights' });
    }
});

module.exports = router;
