const Cliente = require('../models/Cliente');
const Dieta = require('../models/Dieta');
const EntrenamientoRegistro = require('../models/EntrenamientoRegistro');
const Usuario = require('../models/Usuario');

/**
 * Detect if a client is stalled based on weight history
 * @param {string} clientId 
 * @returns {Object|null} Stall report or null
 */
async function analyzeStall(clientId) {
    const cliente = await Cliente.findById(clientId);
    if (!cliente || !cliente.historialProgreso || cliente.historialProgreso.length < 3) return null;

    const advisor = await Usuario.findById(cliente.asesorId);
    const settings = advisor?.settings?.intelligence || {};
    const threshold = settings.stallThreshold ?? 0.2;

    // Sort progress by date descending
    const sortedProgress = [...cliente.historialProgreso].sort((a, b) => b.fecha - a.fecha);
    
    const latest = sortedProgress[0];
    const previous = sortedProgress[1];
    const third = sortedProgress[2];

    const weightDiff1 = latest.peso - previous.peso;
    const weightDiff2 = previous.peso - third.peso;

    // Define "stall" based on configurable threshold
    const isStalled = Math.abs(weightDiff1) < threshold && Math.abs(weightDiff2) < threshold;

    if (isStalled) {
        return {
            clientId,
            type: 'WEIGHT_STALL',
            message: `El cliente ${cliente.nombre} lleva 3 registros con peso estancado (${latest.peso}kg).`,
            latestWeight: latest.peso,
            trend: 'STAGNANT',
            threshold
        };
    }

    return null;
}

/**
 * Detect if client is gaining weight too fast (only for surplus)
 */
async function analyzeRapidGain(clientId) {
    const cliente = await Cliente.findById(clientId);
    if (!cliente || !cliente.historialProgreso || cliente.historialProgreso.length < 3) return null;

    const advisor = await Usuario.findById(cliente.asesorId);
    const settings = advisor?.settings?.intelligence || {};
    const threshold = settings.rapidGainThreshold ?? 0.5;

    // Sort progress by date descending
    const sortedProgress = [...cliente.historialProgreso].sort((a, b) => b.fecha - a.fecha);
    
    // Check positive gain > threshold for last 2 intervals (3 entries)
    const latest = sortedProgress[0];
    const previous = sortedProgress[1];
    const third = sortedProgress[2];

    const gain1 = latest.peso - previous.peso;
    const gain2 = previous.peso - third.peso;

    if (gain1 > threshold && gain2 > threshold) {
        return {
            clientId,
            type: 'WEIGHT_RAPID_GAIN',
            message: `Ganancia acelerada detectada (> ${threshold}kg/semana en 3 registros).`,
            latestWeight: latest.peso,
            trend: 'RAPID_GAIN',
            threshold
        };
    }
    return null;
}

/**
 * Suggest (or apply) macro adjustment based on objective and progress
 * @param {string} clientId 
 * @returns {Object|null} Adjustment suggestion
 */
async function suggestMacroAdjustment(clientId) {
    const cliente = await Cliente.findById(clientId);
    if (!cliente) return null;

    const currentDiet = await Dieta.findOne({ clienteId: clientId, isCurrent: true });
    if (!currentDiet) return null;

    const advisor = await Usuario.findById(cliente.asesorId);
    const settings = advisor?.settings?.intelligence?.macroAdjustment || {};
    
    const objective = currentDiet.objetivo;
    let adjustment = {};
    let insight = null;
    let suggestionType = 'MACROS'; // MACROS or STEPS

    // 1. Check for rapid gain (gain objective)
    if (objective === 'ganancia') {
        insight = await analyzeRapidGain(clientId);
        if (insight) {
             // ADVANCED CHECK: If gaining mostly muscle, ignore alert
             if (settings.advancedAnalysis) {
                const latest = cliente.historialProgreso[0];
                const previous = cliente.historialProgreso[1];
                if (latest.MasaMusculoEsqueletica && previous.MasaMusculoEsqueletica) {
                    const muscleGain = latest.MasaMusculoEsqueletica - previous.MasaMusculoEsqueletica;
                    const weightGain = latest.peso - previous.peso;
                    if (muscleGain > (weightGain * 0.5)) insight = null;
                }
            }

            if (insight) {
                const kcalMult = settings.rapidGain?.kcal ?? 0.95;
                const carbsMult = settings.rapidGain?.carbs ?? 0.9;
                adjustment = {
                    kcal: Math.round(currentDiet.macros.kcal * kcalMult), 
                    c: Math.round(currentDiet.macros.c * carbsMult),      
                    p: currentDiet.macros.p,
                    g: currentDiet.macros.g
                };
            }
        }
    }
    
    // 2. Check for rapid loss (loss/definition objective)
    if ((objective === 'perdida' || objective === 'definicion') && !insight) {
        insight = await analyzeRapidLoss(clientId);
        if (insight) {
            // Suggest increasing calories to slow down loss
            const kcalMult = settings.rapidLoss?.kcal ?? 1.05;
            const carbsMult = settings.rapidLoss?.carbs ?? 1.1;
            adjustment = {
                kcal: Math.round(currentDiet.macros.kcal * kcalMult), 
                c: Math.round(currentDiet.macros.c * carbsMult),      
                p: currentDiet.macros.p,
                g: currentDiet.macros.g
            };
        }
    }

    // 3. If no rapid changes, check for stall
    if (!insight) {
        insight = await analyzeStall(clientId);
        if (insight) {
            // ADVANCED CHECK: Recomp
            let isRecomp = false;
            if (settings.advancedAnalysis) {
                const latest = cliente.historialProgreso[0];
                const previous = cliente.historialProgreso[1];
                if (latest.grasaCorporal && previous.grasaCorporal) {
                    if ((previous.grasaCorporal - latest.grasaCorporal) > 0.3) isRecomp = true;
                }
            }

            if (!isRecomp) {
                // STALL DETECTED
                
                // CHECK STEPS WILDCARD
                const stepsSettings = settings.steps || { enabled: true, prioritize: true, increment: 2000 };
                if (stepsSettings.enabled && stepsSettings.prioritize) {
                    suggestionType = 'STEPS';
                    adjustment = {
                        stepsIncrement: stepsSettings.increment ?? 2000,
                        message: `Aumentar actividad diaria en +${stepsSettings.increment ?? 2000} pasos`
                    };
                } else {
                    // Standard Macro Adjustment
                    if (objective === 'perdida' || objective === 'definicion') {
                        const kcalMult = settings.loss?.kcal ?? 0.9;
                        const carbsMult = settings.loss?.carbs ?? 0.85;
                        adjustment = {
                            kcal: Math.round(currentDiet.macros.kcal * kcalMult),
                            c: Math.round(currentDiet.macros.c * carbsMult),
                            p: currentDiet.macros.p,
                            g: currentDiet.macros.g
                        };
                    } else if (objective === 'ganancia') {
                        const kcalMult = settings.gain?.kcal ?? 1.05;
                        const carbsMult = settings.gain?.carbs ?? 1.1;
                        adjustment = {
                            kcal: Math.round(currentDiet.macros.kcal * kcalMult),
                            c: Math.round(currentDiet.macros.c * carbsMult),
                            p: currentDiet.macros.p,
                            g: currentDiet.macros.g
                        };
                    }
                }
            } else {
                insight = null; // Recomp - ignore
            }
        }
    }

    if (!insight || Object.keys(adjustment).length === 0) return null;

    return {
        originalMacros: currentDiet.macros,
        suggestedMacros: suggestionType === 'MACROS' ? adjustment : null, // Only if macros
        suggestedSteps: suggestionType === 'STEPS' ? adjustment : null,   // Only if steps
        suggestionType,
        reason: insight.message + (settings.advancedAnalysis ? ' (Analizado con composición corporal)' : ''),
        objective,
        type: insight.type
    };
}

/**
 * Analyze recent workout register to suggest progressions
 * @param {string} registroId 
 * @returns {Array} List of suggestions
 */
async function analyzeWorkoutProgression(registroId) {
    const registro = await EntrenamientoRegistro.findById(registroId).populate({
        path: 'ejercicios.ejercicio',
        select: 'grupo'
    });
    if (!registro) return [];

    const cliente = await Cliente.findById(registro.clienteId);
    const advisor = await Usuario.findById(cliente?.asesorId);
    const settings = advisor?.settings?.intelligence?.trainingIncrements || {};

    const suggestions = [];

    for (const exRegistro of registro.ejercicios) {
        const allSetsHitTarget = exRegistro.series.length > 0 && exRegistro.series.every(s => s.reps >= 10);
        
        if (allSetsHitTarget) {
            const grupo = (exRegistro.ejercicio?.grupo || "").toLowerCase();
            
            let increment = settings.medium ?? 2.5;
            let size = "medio";

            const largeGroups = ['pierna', 'cuadriceps', 'espalda', 'pecho', 'gluteo', 'isquios'];
            const smallGroups = ['biceps', 'triceps', 'hombro', 'deltoides', 'antebrazo', 'gemelo', 'abdomen'];

            if (largeGroups.some(g => grupo.includes(g))) {
                increment = settings.large ?? 5;
                size = "grande";
            } else if (smallGroups.some(g => grupo.includes(g))) {
                increment = settings.small ?? 1.25;
                size = "pequeño";
            }

            suggestions.push({
                ejercicio: exRegistro.ejercicioNombre,
                ejercicioId: exRegistro.ejercicio?._id,
                suggestion: `Aumentar carga (+${increment}kg)`,
                reason: `Todas las series completadas en rango alto. Grupo muscular ${size}.`,
                increment
            });
        }
    }

    return suggestions;
}

module.exports = {
    analyzeStall,
    suggestMacroAdjustment,
    analyzeWorkoutProgression
};
