const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const Cliente = require('../models/Cliente');
const Badge = require('../models/Badge');
const Challenge = require('../models/Challenge');
const {
  updateGamificationStats,
  getTrendAnalysis,
  xpToNextLevel,
  BADGE_DEFINITIONS
} = require('../services/gamificationService');

// @route   GET /api/gamification/stats/:clienteId
// @desc    Get gamification statistics for a client
router.get('/stats/:clienteId', authMiddleware, async (req, res) => {
  try {
    const { clienteId } = req.params;
    
    // Update stats first
    await updateGamificationStats(clienteId);
    
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) {
      return res.status(404).json({ msg: 'Cliente not found' });
    }
    
    const gamification = cliente.gamification || {};
    const level = gamification.level || 1;
    const currentXP = gamification.points || 0;
    const xpForNext = xpToNextLevel(level);
    const xpInCurrentLevel = currentXP - Math.pow(level - 1, 2) * 100;
    const xpNeededForLevel = Math.pow(level, 2) * 100 - Math.pow(level - 1, 2) * 100;
    
    // Get trend analysis
    const trend = await getTrendAnalysis(clienteId);
    
    res.json({
      currentStreak: gamification.currentStreak || 0,
      longestStreak: gamification.longestStreak || 0,
      level,
      currentXP,
      xpToNextLevel: xpForNext - currentXP,
      xpInCurrentLevel,
      xpNeededForLevel,
      totalHabitsCompleted: gamification.totalHabitsCompleted || 0,
      trend
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/gamification/badges/:clienteId
// @desc    Get all badges (locked and unlocked) for a client
router.get('/badges/:clienteId', authMiddleware, async (req, res) => {
  try {
    const { clienteId } = req.params;
    
    // Get unlocked badges
    const unlockedBadges = await Badge.find({ clienteId }).sort({ unlockedAt: -1 });
    
    // Get cliente for stats
    const cliente = await Cliente.findById(clienteId);
    const stats = {
      currentStreak: cliente?.gamification?.currentStreak || 0,
      longestStreak: cliente?.gamification?.longestStreak || 0,
      level: cliente?.gamification?.level || 1,
      totalChallenges: await Challenge.countDocuments({ clienteId, completed: true })
    };
    
    // Create list of all possible badges with lock status
    const allBadges = Object.entries(BADGE_DEFINITIONS).map(([badgeType, info]) => {
      const unlocked = unlockedBadges.find(b => b.badgeType === badgeType);
      
      // Calculate progress for locked badges
      let progress = 0;
      let progressMax = 1;
      
      if (!unlocked) {
        if (badgeType.startsWith('STREAK_')) {
          const targetStreakString = badgeType.split('_')[1];
          const targetStreak = parseInt(targetStreakString);
          progress = stats.currentStreak;
          progressMax = targetStreak;
        } else if (badgeType.startsWith('LEVEL_')) {
          const targetLevelString = badgeType.split('_')[1];
          const targetLevel = parseInt(targetLevelString);
          progress = stats.level;
          progressMax = targetLevel;
        } else if (badgeType === 'CHALLENGE_CHAMPION') {
          progress = stats.totalChallenges;
          progressMax = 10;
        }
      }
      
      return {
        badgeType,
        ...info,
        isLocked: !unlocked,
        unlockedAt: unlocked?.unlockedAt || null,
        progress: unlocked ? progressMax : progress,
        progressMax
      };
    });
    
    res.json(allBadges);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/gamification/challenges
// @desc    Create a new challenge (advisor only)
router.post('/challenges', authMiddleware, async (req, res) => {
  try {
    const {
      clienteId,
      title,
      description,
      targetHabitId,
      targetType,
      targetValue,
      startDate,
      endDate,
      xpReward
    } = req.body;
    
    const challenge = new Challenge({
      clienteId,
      asesorId: req.user.id,
      title,
      description,
      targetHabitId,
      targetType: targetType || 'days_completed',
      targetValue,
      startDate: startDate || new Date(),
      endDate,
      xpReward: xpReward || 100
    });
    
    await challenge.save();
    res.json(challenge);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/gamification/challenges/:clienteId
// @desc    Get all challenges for a client
router.get('/challenges/:clienteId', authMiddleware, async (req, res) => {
  try {
    const { clienteId } = req.params;
    const { active } = req.query;
    
    let query = { clienteId };
    
    if (active === 'true') {
      const now = new Date();
      query.completed = false;
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };
    }
    
    const challenges = await Challenge.find(query)
      .populate('targetHabitId', 'nombre tipo unidad')
      .sort({ endDate: -1 });
    
    // Calculate progress percentage for each
    const challengesWithProgress = challenges.map(challenge => {
      const progressPercentage = Math.min(
        Math.round((challenge.progress / challenge.targetValue) * 100),
        100
      );
      
      return {
        ...challenge.toObject(),
        progressPercentage
      };
    });
    
    res.json(challengesWithProgress);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/gamification/challenges/:id/complete
// @desc    Manually mark a challenge as complete (for testing or manual override)
router.put('/challenges/:id/complete', authMiddleware, async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    
    if (!challenge) {
      return res.status(404).json({ msg: 'Challenge not found' });
    }
    
    if (challenge.completed) {
      return res.status(400).json({ msg: 'Challenge already completed' });
    }
    
    challenge.completed = true;
    challenge.completedAt = new Date();
    await challenge.save();
    
    // Award XP
    const { awardXP } = require('../services/gamificationService');
    await awardXP(challenge.clienteId, challenge.xpReward, 'CHALLENGE_COMPLETE');
    
    res.json(challenge);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/gamification/challenges/:id
// @desc    Delete a challenge
router.delete('/challenges/:id', authMiddleware, async (req, res) => {
  try {
    const challenge = await Challenge.findByIdAndDelete(req.params.id);
    
    if (!challenge) {
      return res.status(404).json({ msg: 'Challenge not found' });
    }
    
    res.json({ msg: 'Challenge deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/gamification/leaderboard
// @desc    Get top clients based on XP
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const clients = await Cliente.find({})
      .select('name gamification')
      .sort({ 'gamification.points': -1 })
      .limit(50);

    const leaderboard = clients.map(cliente => ({
      name: cliente.name,
      level: cliente.gamification?.level || 1,
      points: cliente.gamification?.points || 0,
      streak: cliente.gamification?.currentStreak || 0
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
