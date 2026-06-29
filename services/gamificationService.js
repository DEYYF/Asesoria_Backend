const Cliente = require('../models/Cliente');
const Badge = require('../models/Badge');
const Challenge = require('../models/Challenge');
const HabitoRegistro = require('../models/HabitoRegistro');
const Habito = require('../models/Habito');

// Badge definitions with unlock conditions
const BADGE_DEFINITIONS = {
  STREAK_7: {
    title: 'Racha de 7 Días',
    description: 'Completaste hábitos durante 7 días consecutivos',
    icon: '🔥',
    category: 'streaks'
  },
  STREAK_30: {
    title: 'Racha de 30 Días',
    description: 'Completaste hábitos durante 30 días consecutivos',
    icon: '⚡',
    category: 'streaks'
  },
  STREAK_100: {
    title: 'Racha de 100 Días',
    description: 'Completaste hábitos durante 100 días consecutivos',
    icon: '💎',
    category: 'streaks'
  },
  HABIT_MASTER: {
    title: 'Maestro de Hábitos',
    description: 'Completaste todos tus hábitos durante 30 días',
    icon: '👑',
    category: 'habits'
  },
  LEVEL_5: {
    title: 'Nivel 5',
    description: 'Alcanzaste el nivel 5',
    icon: '⭐',
    category: 'levels'
  },
  LEVEL_10: {
    title: 'Nivel 10',
    description: 'Alcanzaste el nivel 10',
    icon: '🌟',
    category: 'levels'
  },
  LEVEL_20: {
    title: 'Nivel 20',
    description: 'Alcanzaste el nivel 20',
    icon: '✨',
    category: 'levels'
  },
  LEVEL_50: {
    title: 'Nivel 50',
    description: 'Alcanzaste el nivel 50',
    icon: '🏆',
    category: 'levels'
  },
  CHALLENGE_CHAMPION: {
    title: 'Campeón de Desafíos',
    description: 'Completaste 10 desafíos',
    icon: '🎯',
    category: 'challenges'
  },
  PERFECT_WEEK: {
    title: 'Semana Perfecta',
    description: 'Completaste todos tus hábitos durante una semana',
    icon: '💪',
    category: 'habits'
  },
  PERFECT_MONTH: {
    title: 'Mes Perfecto',
    description: 'Completaste todos tus hábitos durante un mes',
    icon: '🎖️',
    category: 'habits'
  }
};

/**
 * Calculate current streak for a client
 */
async function calculateStreak(clienteId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let currentStreak = 0;
  let checkDate = new Date(today);
  
  // Get all active habits for the client
  const habits = await Habito.find({ clienteId, activo: true });
  if (habits.length === 0) return 0;
  
  // Check backwards from today
  while (true) {
    const dayStart = new Date(checkDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(checkDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    // Get logs for this day
    const logs = await HabitoRegistro.find({
      clienteId,
      fecha: { $gte: dayStart, $lte: dayEnd }
    });
    
    // Check if at least one habit was completed
    const hasCompletedHabit = logs.some(log => 
      log.completado === true || (log.valor !== null && log.valor !== undefined)
    );
    
    if (!hasCompletedHabit) {
      break;
    }
    
    currentStreak++;
    checkDate.setDate(checkDate.getDate() - 1);
    
    // Safety limit to prevent infinite loops
    if (currentStreak > 365) break;
  }
  
  return currentStreak;
}

/**
 * Calculate XP for completing a habit
 */
function calculateHabitXP(currentStreak) {
  const baseXP = 10;
  const streakBonus = currentStreak >= 7 ? 5 : 0;
  return baseXP + streakBonus;
}

/**
 * Calculate level from total XP
 */
function calculateLevel(totalXP) {
  return Math.floor(Math.sqrt(totalXP / 100)) + 1;
}

/**
 * Calculate XP needed for next level
 */
function xpToNextLevel(currentLevel) {
  const nextLevel = currentLevel + 1;
  const xpForNextLevel = Math.pow(nextLevel - 1, 2) * 100;
  return xpForNextLevel;
}

/**
 * Update gamification stats after habit completion
 */
async function updateGamificationStats(clienteId) {
  try {
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) return null;
    
    // Calculate current streak
    const currentStreak = await calculateStreak(clienteId);
    
    // Update longest streak if current is higher
    const longestStreak = Math.max(
      currentStreak, 
      cliente.gamification?.longestStreak || 0
    );
    
    // Calculate XP and level
    const totalXP = cliente.gamification?.points || 0;
    const level = calculateLevel(totalXP);
    
    // Update cliente
    cliente.gamification = {
      ...cliente.gamification,
      currentStreak,
      longestStreak,
      level,
      lastActivityDate: new Date(),
      lastStreakUpdate: new Date()
    };
    
    await cliente.save();
    
    // Check for badge unlocks
    await checkAndUnlockBadges(clienteId, {
      currentStreak,
      longestStreak,
      level,
      totalXP
    });
    
    return cliente.gamification;
  } catch (error) {
    console.error('Error updating gamification stats:', error);
    return null;
  }
}

/**
 * Award XP to a client
 */
async function awardXP(clienteId, xp, action = 'HABIT_COMPLETE') {
  try {
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) return null;
    
    const currentXP = cliente.gamification?.points || 0;
    const newXP = currentXP + xp;
    const newLevel = calculateLevel(newXP);
    const oldLevel = cliente.gamification?.level || 1;
    
    // Update points and level
    cliente.gamification = {
      ...cliente.gamification,
      points: newXP,
      level: newLevel,
      totalHabitsCompleted: (cliente.gamification?.totalHabitsCompleted || 0) + 1,
      history: [
        ...(cliente.gamification?.history || []),
        {
          action,
          points: xp,
          date: new Date()
        }
      ]
    };
    
    await cliente.save();
    
    // Check for level-based badge unlocks
    if (newLevel > oldLevel) {
      await checkLevelBadges(clienteId, newLevel);
    }
    
    return cliente.gamification;
  } catch (error) {
    console.error('Error awarding XP:', error);
    return null;
  }
}

/**
 * Check and unlock badges based on achievements
 */
async function checkAndUnlockBadges(clienteId, stats) {
  const badgesToCheck = [];
  
  // Streak badges
  if (stats.currentStreak >= 7) badgesToCheck.push('STREAK_7');
  if (stats.currentStreak >= 30) badgesToCheck.push('STREAK_30');
  if (stats.currentStreak >= 100) badgesToCheck.push('STREAK_100');
  
  // Level badges
  if (stats.level >= 5) badgesToCheck.push('LEVEL_5');
  if (stats.level >= 10) badgesToCheck.push('LEVEL_10');
  if (stats.level >= 20) badgesToCheck.push('LEVEL_20');
  if (stats.level >= 50) badgesToCheck.push('LEVEL_50');
  
  // Unlock badges
  for (const badgeType of badgesToCheck) {
    await unlockBadge(clienteId, badgeType);
  }
}

/**
 * Check level-based badges
 */
async function checkLevelBadges(clienteId, level) {
  if (level >= 5) await unlockBadge(clienteId, 'LEVEL_5');
  if (level >= 10) await unlockBadge(clienteId, 'LEVEL_10');
  if (level >= 20) await unlockBadge(clienteId, 'LEVEL_20');
  if (level >= 50) await unlockBadge(clienteId, 'LEVEL_50');
}

/**
 * Unlock a specific badge for a client
 */
async function unlockBadge(clienteId, badgeType) {
  try {
    // Check if badge already exists
    const existingBadge = await Badge.findOne({ clienteId, badgeType });
    if (existingBadge) return existingBadge;
    
    // Create new badge
    const badgeInfo = BADGE_DEFINITIONS[badgeType];
    const badge = new Badge({
      clienteId,
      badgeType,
      ...badgeInfo
    });
    
    await badge.save();
    
    // Add badge to cliente
    await Cliente.findByIdAndUpdate(clienteId, {
      $addToSet: { 'gamification.badges': badge._id }
    });
    
    return badge;
  } catch (error) {
    // Ignore duplicate key errors
    if (error.code === 11000) return null;
    console.error('Error unlocking badge:', error);
    return null;
  }
}

/**
 * Get trend analysis comparing current month to previous month
 */
async function getTrendAnalysis(clienteId) {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    
    // Get current month logs
    const currentMonthLogs = await HabitoRegistro.find({
      clienteId,
      fecha: { $gte: currentMonthStart }
    });
    
    // Get previous month logs
    const previousMonthLogs = await HabitoRegistro.find({
      clienteId,
      fecha: { $gte: previousMonthStart, $lte: previousMonthEnd }
    });
    
    // Calculate completion rates
    const currentCompleted = currentMonthLogs.filter(log => 
      log.completado === true || (log.valor !== null && log.valor !== undefined)
    ).length;
    
    const previousCompleted = previousMonthLogs.filter(log => 
      log.completado === true || (log.valor !== null && log.valor !== undefined)
    ).length;
    
    // Calculate days in each period for fair comparison
    const daysInCurrentMonth = Math.floor((now - currentMonthStart) / (1000 * 60 * 60 * 24)) + 1;
    const daysInPreviousMonth = Math.floor((previousMonthEnd - previousMonthStart) / (1000 * 60 * 60 * 24)) + 1;
    
    const currentRate = currentCompleted / daysInCurrentMonth;
    const previousRate = previousCompleted / daysInPreviousMonth;
    
    // Calculate percentage change
    let percentageChange = 0;
    let message = '';
    
    if (previousRate > 0) {
      percentageChange = Math.round(((currentRate - previousRate) / previousRate) * 100);
      
      if (percentageChange > 0) {
        message = `Este mes has mejorado un ${percentageChange}% respecto al anterior`;
      } else if (percentageChange < 0) {
        message = `Este mes has bajado un ${Math.abs(percentageChange)}% respecto al anterior`;
      } else {
        message = 'Mantienes el mismo ritmo que el mes anterior';
      }
    } else {
      message = 'Este es tu primer mes, ¡sigue así!';
    }
    
    return {
      percentageChange,
      message,
      currentMonthCompleted: currentCompleted,
      previousMonthCompleted: previousCompleted
    };
  } catch (error) {
    console.error('Error calculating trend analysis:', error);
    return {
      percentageChange: 0,
      message: 'No hay suficientes datos para el análisis',
      currentMonthCompleted: 0,
      previousMonthCompleted: 0
    };
  }
}

/**
 * Update challenge progress
 */
async function updateChallengeProgress(clienteId, habitoId) {
  try {
    const now = new Date();
    
    // Find active challenges for this client and habit
    const challenges = await Challenge.find({
      clienteId,
      completed: false,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { targetHabitId: habitoId },
        { targetType: 'all_habits' }
      ]
    });
    
    for (const challenge of challenges) {
      let progress = 0;
      
      if (challenge.targetType === 'days_completed') {
        // Count days where habit was completed
        const logs = await HabitoRegistro.find({
          clienteId,
          habitoId: challenge.targetHabitId,
          fecha: { $gte: challenge.startDate, $lte: challenge.endDate },
          completado: true
        });
        progress = logs.length;
      } else if (challenge.targetType === 'total_value') {
        // Sum up values
        const logs = await HabitoRegistro.find({
          clienteId,
          habitoId: challenge.targetHabitId,
          fecha: { $gte: challenge.startDate, $lte: challenge.endDate }
        });
        progress = logs.reduce((sum, log) => sum + (log.valor || 0), 0);
      } else if (challenge.targetType === 'all_habits') {
        // Count days where all habits were completed
        const habits = await Habito.find({ clienteId, activo: true });
        const habitIds = habits.map(h => h._id);
        
        let daysCompleted = 0;
        let checkDate = new Date(challenge.startDate);
        
        while (checkDate <= challenge.endDate && checkDate <= now) {
          const dayStart = new Date(checkDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(checkDate);
          dayEnd.setHours(23, 59, 59, 999);
          
          const dayLogs = await HabitoRegistro.find({
            clienteId,
            fecha: { $gte: dayStart, $lte: dayEnd }
          });
          
          const allCompleted = habitIds.every(habitId => 
            dayLogs.some(log => 
              log.habitoId.toString() === habitId.toString() && 
              (log.completado === true || log.valor !== null)
            )
          );
          
          if (allCompleted) daysCompleted++;
          checkDate.setDate(checkDate.getDate() + 1);
        }
        
        progress = daysCompleted;
      }
      
      challenge.progress = progress;
      
      // Check if challenge is completed
      if (progress >= challenge.targetValue && !challenge.completed) {
        challenge.completed = true;
        challenge.completedAt = new Date();
        
        // Award XP
        await awardXP(clienteId, challenge.xpReward, 'CHALLENGE_COMPLETE');
        
        // Check for challenge champion badge
        const completedChallenges = await Challenge.countDocuments({
          clienteId,
          completed: true
        });
        
        if (completedChallenges >= 10) {
          await unlockBadge(clienteId, 'CHALLENGE_CHAMPION');
        }
      }
      
      await challenge.save();
    }
  } catch (error) {
    console.error('Error updating challenge progress:', error);
  }
}

module.exports = {
  calculateStreak,
  calculateHabitXP,
  calculateLevel,
  xpToNextLevel,
  updateGamificationStats,
  awardXP,
  unlockBadge,
  getTrendAnalysis,
  updateChallengeProgress,
  BADGE_DEFINITIONS
};
