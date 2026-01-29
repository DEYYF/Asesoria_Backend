const Cliente = require('../models/Cliente');

const LEVELS = [
    { level: 1, minPoints: 0, name: 'Novato' },
    { level: 2, minPoints: 500, name: 'Principiante' },
    { level: 3, minPoints: 1500, name: 'Intermedio' },
    { level: 4, minPoints: 3000, name: 'Avanzado' },
    { level: 5, minPoints: 6000, name: 'Elite' },
    { level: 6, minPoints: 10000, name: 'Leyenda' }
];

const POINTS_CONFIG = {
    WORKOUT_COMPLETED: 50,
    PROGRESS_UPDATED: 100,
    MEAL_LOGGED: 10,
    CHECKIN_COMPLETED: 75
};

/**
 * Award points to a client and handle level ups / streaks
 * @param {string} clientId 
 * @param {string} actionType - One of POINTS_CONFIG keys
 */
async function awardPoints(clientId, actionType) {
    const points = POINTS_CONFIG[actionType];
    if (!points) return null;

    const cliente = await Cliente.findById(clientId);
    if (!cliente) return null;

    if (!cliente.gamification) {
        cliente.gamification = { points: 0, level: 1, currentStreak: 0, history: [] };
    }

    // 1. Add Points
    cliente.gamification.points += points;
    cliente.gamification.history.push({
        action: actionType,
        points: points,
        date: new Date()
    });

    // Trim history to last 50 entries
    if (cliente.gamification.history.length > 50) {
        cliente.gamification.history = cliente.gamification.history.slice(-50);
    }

    // 2. Check Level Up
    const newLevel = calculateLevel(cliente.gamification.points);
    let leveledUp = false;
    if (newLevel > cliente.gamification.level) {
        cliente.gamification.level = newLevel;
        leveledUp = true;
    }

    // 3. Update Streak (Daily)
    const now = new Date();
    const lastDate = cliente.gamification.lastActivityDate ? new Date(cliente.gamification.lastActivityDate) : null;
    
    if (!lastDate) {
        // First activity ever
        cliente.gamification.currentStreak = 1;
    } else {
        const diffTime = Math.abs(now - lastDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (lastDate.getDate() !== now.getDate()) { // Only if different day
            if (diffDays <= 1) {
                // If yesterday or today (consecutive)
                 // Note: diffDays might be 0 if same day, checked above. 
                 // Actually logic: if (now.day == last.day + 1) -> increment
                 // Simplified: check if lastDate was "yesterday"
                 const yesterday = new Date(now); 
                 yesterday.setDate(yesterday.getDate() - 1);
                 
                 if (lastDate.toDateString() === yesterday.toDateString()) {
                     cliente.gamification.currentStreak += 1;
                 } else if (lastDate.toDateString() !== now.toDateString()) {
                     // Gap > 1 day, reset
                     cliente.gamification.currentStreak = 1;
                 }
            } else {
                cliente.gamification.currentStreak = 1; 
            }
        }
    }
    
    cliente.gamification.lastActivityDate = now;

    await cliente.save();

    return {
        totalPoints: cliente.gamification.points,
        level: cliente.gamification.level,
        levelName: LEVELS.find(l => l.level === cliente.gamification.level)?.name,
        leveledUp,
        streak: cliente.gamification.currentStreak
    };
}

function calculateLevel(points) {
    // Reverse find the highest level met
    const level = [...LEVELS].reverse().find(l => points >= l.minPoints);
    return level ? level.level : 1;
}

module.exports = {
    awardPoints,
    calculateLevel,
    LEVELS,
    POINTS_CONFIG
};
