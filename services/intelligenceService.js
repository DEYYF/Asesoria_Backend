const Cliente = require('../models/Cliente');
const Dieta = require('../models/Dieta');
const Entrenamiento = require('../models/Entrenamiento');
const Tarea = require('../models/Tarea');

/**
 * Intelligence Service
 * Analyzes client data and generates proactive recommendations for advisors
 */

/**
 * Main analysis function - orchestrates all analysis types
 * @param {String} clienteId - Client ID to analyze
 * @returns {Object} Analysis results with insights and recommendations
 */
async function analyzeClientProgress(clienteId) {
  try {
    // Fetch client data
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) {
      throw new Error('Cliente no encontrado');
    }

    const insights = [];
    const now = new Date();

    // 1. Analyze weight stagnation
    const weightInsight = await detectWeightStagnation(cliente.historialProgreso);
    if (weightInsight) insights.push(weightInsight);

    // 2. Analyze macro adherence (recent diets)
    const macroInsight = await analyzeMacroAdherence(clienteId);
    if (macroInsight) insights.push(macroInsight);

    // 3. Analyze training adherence
    const trainingInsight = await analyzeTrainingAdherence(clienteId);
    if (trainingInsight) insights.push(trainingInsight);

    // 4. Analyze task completion
    const taskInsight = await analyzeTaskCompletion(clienteId);
    if (taskInsight) insights.push(taskInsight);

    // 5. Analyze gamification engagement
    const gamificationInsight = analyzeGamificationEngagement(cliente.gamification);
    if (gamificationInsight) insights.push(gamificationInsight);

    // Calculate summary
    const summary = {
      totalInsights: insights.length,
      highPriority: insights.filter(i => i.severity === 'high').length,
      mediumPriority: insights.filter(i => i.severity === 'medium').length,
      lowPriority: insights.filter(i => i.severity === 'low').length,
    };

    return {
      clienteId,
      clienteName: cliente.nombre,
      analyzedAt: now.toISOString(),
      insights,
      summary,
    };
  } catch (error) {
    console.error('Error analyzing client progress:', error);
    throw error;
  }
}

/**
 * Calculates difference in days between two dates
 * @param {Date} d1 - Newer date
 * @param {Date} d2 - Older date
 * @returns {Number} Difference in days
 */
const getDaysDifference = (d1, d2) => Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));

/**
 * Detects weight stagnation (plateau)
 * @param {Array} progressHistory - Client's progress history
 * @returns {Object|null} Insight if stagnation detected
 */
function detectWeightStagnation(progressHistory) {
  if (!progressHistory || !Array.isArray(progressHistory) || progressHistory.length < 3) return null;

  // Sort by date descending
  // Optimization: Check if already sorted before sorting if possible, but safe to sort copy
  const sorted = [...progressHistory].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  
  // Get last 14 days of data
  const now = new Date();
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  twoWeeksAgo.setHours(0, 0, 0, 0); // Reset to start of day
  
  // Optimization: use timestamp comparison for faster filtering
  const twoWeeksAgoTime = twoWeeksAgo.getTime();
  const recentData = sorted.filter(entry => {
    const entryDate = new Date(entry.fecha);
    return entryDate.getTime() >= twoWeeksAgoTime && entry.peso !== undefined && entry.peso !== null;
  });
  
  if (recentData.length < 2) return null;

  // Calculate weight variance
  const weights = recentData.map(d => Number(d.peso));
  const maxWeight = Math.max(...weights);
  const minWeight = Math.min(...weights);
  const variance = maxWeight - minWeight;

  // Stagnation detected if variance < 0.5kg over 2 weeks
  if (variance < 0.5 && recentData.length >= 3) {
    const currentWeight = weights[0];
    
    // Look back further to find true start of stagnation
    let stagnationStartDate = new Date(recentData[recentData.length - 1].fecha);
    
    // Find true start date by checking older entries
    for (const entry of sorted) {
      if (!entry.peso) continue;
      const entryDate = new Date(entry.fecha);
      if (entryDate >= stagnationStartDate) continue; // Skip newer or same
      
      const entryWeight = Number(entry.peso);
      // If weight is still within range relative to current weight (approx), extend stagnation
      // Using 0.5kg threshold from current weight to define the "plateau band"
      if (Math.abs(entryWeight - currentWeight) <= 0.5) {
        stagnationStartDate = entryDate;
      } else {
        break; // Stagnation broken
      }
    }

    const daysStagnant = getDaysDifference(now, stagnationStartDate);

    return {
      type: 'weight_stagnation',
      severity: daysStagnant > 21 ? 'high' : 'medium',
      title: 'Estancamiento de peso detectado',
      description: `Sin cambios significativos en ${daysStagnant} días (variación: ${variance.toFixed(1)}kg)`,
      recommendation: 'Considera ajustar la ingesta calórica en ±200-300 kcal o revisar el plan de entrenamiento',
      data: {
        currentWeight,
        variance,
        daysStagnant,
        dataPoints: recentData.length,
      },
      actionable: true,
      suggestedActions: [
        'Reducir calorías en 200-300 kcal',
        'Aumentar intensidad del entrenamiento',
        'Revisar adherencia a la dieta',
      ],
    };
  }

  return null;
}

/**
 * Analyzes macro adherence from recent diets
 * @param {String} clienteId - Client ID
 * @returns {Object|null} Insight if issues detected
 */
async function analyzeMacroAdherence(clienteId) {
  try {
    // Get last 2 diets
    // Optimization: Select only necessary fields
    const dietas = await Dieta.find({ clienteId })
      .select('dias createdAt')
      .sort({ createdAt: -1 })
      .limit(2)
      .lean(); // Optimization: Return plain JS objects

    if (dietas.length < 2) return null;

    const [current, previous] = dietas;
    
    // Calculate total macros for each diet
    const getCurrentMacros = (dieta) => {
      let totalKcal = 0;
      // We only focus on Kcal for the alert currently to save computation
      // But keeping full structure for future extensibility
      
      if (!dieta.dias || !Array.isArray(dieta.dias)) return { kcal: 0 };

      dieta.dias.forEach(dia => {
        if (dia.comidas && Array.isArray(dia.comidas)) {
          dia.comidas.forEach(comida => {
            if (comida.alimentos && Array.isArray(comida.alimentos)) {
              comida.alimentos.forEach(alimento => {
                totalKcal += alimento.kcal || 0;
              });
            }
          });
        }
      });

      const numDays = dieta.dias.length || 1;
      return {
        kcal: totalKcal / numDays,
      };
    };

    const currentMacros = getCurrentMacros(current);
    const previousMacros = getCurrentMacros(previous);

    // Prevent division by zero
    if (previousMacros.kcal === 0) return null;

    const kcalDiff = currentMacros.kcal - previousMacros.kcal;
    const kcalDiffPercent = (kcalDiff / previousMacros.kcal) * 100;

    // Alert if drastic change (>20%)
    if (Math.abs(kcalDiffPercent) > 20) {
      return {
        type: 'macro_change_alert',
        severity: Math.abs(kcalDiffPercent) > 30 ? 'high' : 'medium',
        title: 'Cambio significativo en macros',
        description: `Las calorías han ${kcalDiff > 0 ? 'aumentado' : 'disminuido'} un ${Math.abs(kcalDiffPercent).toFixed(1)}%`,
        recommendation: 'Monitorear la respuesta del cliente durante las próximas 2 semanas',
        data: {
          currentKcal: Math.round(currentMacros.kcal),
          previousKcal: Math.round(previousMacros.kcal),
          difference: Math.round(kcalDiff),
          percentChange: kcalDiffPercent.toFixed(1),
        },
        actionable: false,
      };
    }

    return null;
  } catch (error) {
    console.error('Error analyzing macro adherence:', error);
    return null; // Fail gracefully
  }
}

/**
 * Analyzes training adherence
 * @param {String} clienteId - Client ID
 * @returns {Object|null} Insight if low adherence detected
 */
async function analyzeTrainingAdherence(clienteId) {
  try {
    // Get training sessions from last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Optimization: Count total and completed in database if possible, 
    // but schema structure suggests fetching might be safer for complex logic.
    // However, we can use .lean() and select.
    const entrenamientos = await Entrenamiento.find({
      clienteId,
      fecha: { $gte: thirtyDaysAgo },
    }).select('fecha completado').lean();

    if (entrenamientos.length === 0) {
      return {
        type: 'no_training_data',
        severity: 'medium',
        title: 'Sin datos de entrenamiento',
        description: 'No hay entrenamientos registrados en los últimos 30 días',
        recommendation: 'Contactar al cliente para verificar adherencia al plan',
        data: {
          daysWithoutData: 30,
        },
        actionable: true,
        suggestedActions: [
          'Enviar recordatorio para registrar entrenamientos',
          'Revisar si el plan es adecuado',
        ],
      };
    }

    // Calculate completion rate
    const totalSessions = entrenamientos.length;
    const completedSessions = entrenamientos.filter(e => e.completado).length;
    const completionRate = (completedSessions / totalSessions) * 100;

    if (completionRate < 70) {
      return {
        type: 'low_training_adherence',
        severity: completionRate < 50 ? 'high' : 'medium',
        title: 'Baja adherencia al entrenamiento',
        description: `Solo ${completionRate.toFixed(0)}% de sesiones completadas (${completedSessions}/${totalSessions})`,
        recommendation: 'Revisar barreras y ajustar el plan si es necesario',
        data: {
          totalSessions,
          completedSessions,
          completionRate: completionRate.toFixed(1),
        },
        actionable: true,
        suggestedActions: [
          'Simplificar el plan de entrenamiento',
          'Discutir obstáculos con el cliente',
          'Ajustar frecuencia o intensidad',
        ],
      };
    }

    return null;
  } catch (error) {
    console.error('Error analyzing training adherence:', error);
    return null;
  }
}

/**
 * Analyzes task completion patterns
 * @param {String} clienteId - Client ID
 * @returns {Object|null} Insight if issues detected
 */
async function analyzeTaskCompletion(clienteId) {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const tareas = await Tarea.find({
      clienteId,
      createdAt: { $gte: thirtyDaysAgo },
    }).select('completada fechaLimite createdAt').lean();

    if (tareas.length === 0) return null;

    const overdueTasks = tareas.filter(t => 
      !t.completada && t.fechaLimite && new Date(t.fechaLimite) < now
    );

    const completedTasks = tareas.filter(t => t.completada);
    const completionRate = (completedTasks.length / tareas.length) * 100;

    if (overdueTasks.length > 3 || completionRate < 60) {
      return {
        type: 'task_completion_issues',
        severity: overdueTasks.length > 5 ? 'high' : 'medium',
        title: 'Problemas con tareas',
        description: `${overdueTasks.length} tareas vencidas, ${completionRate.toFixed(0)}% de completitud`,
        recommendation: 'Revisar carga de trabajo y prioridades con el cliente',
        data: {
          totalTasks: tareas.length,
          completedTasks: completedTasks.length,
          overdueTasks: overdueTasks.length,
          completionRate: completionRate.toFixed(1),
        },
        actionable: true,
        suggestedActions: [
          'Repriorizar tareas pendientes',
          'Eliminar tareas obsoletas',
          'Reducir carga de tareas',
        ],
      };
    }

    return null;
  } catch (error) {
    console.error('Error analyzing task completion:', error);
    return null;
  }
}

/**
 * Analyzes gamification engagement
 * @param {Object} gamification - Client's gamification data
 * @returns {Object|null} Insight if low engagement detected
 */
function analyzeGamificationEngagement(gamification) {
  if (!gamification) return null;

  const { currentStreak, lastActivityDate, points } = gamification;

  // Check if streak is broken (no activity in 7+ days)
  if (lastActivityDate) {
    const daysSinceActivity = getDaysDifference(new Date(), new Date(lastActivityDate));
    
    if (daysSinceActivity > 7) {
      return {
        type: 'low_engagement',
        severity: daysSinceActivity > 14 ? 'high' : 'medium',
        title: 'Baja actividad del cliente',
        description: `Sin actividad registrada en ${daysSinceActivity} días`,
        recommendation: 'Contactar al cliente para verificar su situación',
        data: {
          daysSinceActivity,
          currentStreak: currentStreak || 0,
          totalPoints: points || 0,
        },
        actionable: true,
        suggestedActions: [
          'Enviar mensaje de seguimiento',
          'Ofrecer sesión de motivación',
          'Revisar si necesita ajustes al plan',
        ],
      };
    }
  }

  return null;
}

module.exports = {
  analyzeClientProgress,
  detectWeightStagnation,
  analyzeMacroAdherence,
  analyzeTrainingAdherence,
  analyzeTaskCompletion,
  analyzeGamificationEngagement,
};
