const Automation = require('../models/Automation');
const Template = require('../models/Template');
const Cliente = require('../models/Cliente');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Dieta = require('../models/Dieta');
const { sendEmail } = require('./notifier');
const ScheduledTask = require('../models/ScheduledTask');

/**
 * Trigger automations for a specific event
 * @param {string} trigger - e.g. 'CLIENT_REGISTERED'
 * @param {Object} data - { advisorId, clientId, budgetId, appointmentId, ... }
 */
async function triggerAutomations(trigger, data) {
  try {
    const { advisorId, clientId } = data;
    
    // Find active automations for this advisor and trigger
    const automations = await Automation.find({
      advisorId,
      trigger,
      active: true
    }).populate('actions.templateId');

    if (!automations.length) return;

    const cliente = clientId ? await Cliente.findById(clientId) : null;

    for (const automation of automations) {
      // Check conditions if any
      if (automation.conditions && Object.keys(automation.conditions).length > 0) {
        if (!evaluateConditions(automation.conditions, cliente)) {
          console.log(`[Automation] Conditions not met for ${cliente?.nombre}. Skipping ${automation.name}`);
          continue;
        }
      }
      
      for (const action of automation.actions) {
        if (action.delay > 0) {
          // Schedule delayed action using ScheduledTask model
          const executeAt = new Date();
          executeAt.setMinutes(executeAt.getMinutes() + action.delay);

          await ScheduledTask.create({
            advisorId,
            clientId: cliente?._id,
            automationId: automation._id,
            action,
            triggerData: data,
            executeAt,
            status: 'PENDING'
          });

          console.log(`[Automation] Persistent task scheduled for ${cliente?.nombre} at ${executeAt.toISOString()}`);
          continue;
        }

        await executeAction(action, { cliente, advisorId, data });
      }
    }
  } catch (e) {
    console.error(`[Automation] Error triggering ${trigger}:`, e);
  }
}

async function executeAction(action, { cliente, advisorId, data }) {
  let content = action.contentOverride || "";
  let subject = "Notificación de Asesoría";

  if (action.templateId) {
    content = action.templateId.content;
    subject = action.templateId.subject || subject;
  }

  // Basic variable replacement
  if (cliente) {
    content = content.replace(/{{cliente_nombre}}/g, cliente.nombre || "");
    content = content.replace(/{{cliente_nombres}}/g, cliente.nombre || ""); // Alias
    content = content.replace(/{{cliente_email}}/g, cliente.email || "");
    content = content.replace(/{{cliente_telefono}}/g, cliente.telefono || "");
    content = content.replace(/{{tarifa}}/g, cliente.Tarifa || "");

    // Advanced Metrics
    if (cliente.historialProgreso && cliente.historialProgreso.length > 0) {
      const sorted = [...cliente.historialProgreso].sort((a, b) => b.fecha - a.fecha);
      const latest = sorted[0];
      const first = sorted[sorted.length - 1];

      content = content.replace(/{{peso_actual}}/g, `${latest.peso || "--"} kg`);
      content = content.replace(/{{grasa_actual}}/g, `${latest.grasaCorporal || "--"}%`);
      
      const totalLost = (first.peso - latest.peso).toFixed(1);
      content = content.replace(/{{peso_perdido_total}}/g, `${totalLost} kg`);
    } else {
      content = content.replace(/{{peso_actual}}/g, "-- kg");
      content = content.replace(/{{grasa_actual}}/g, "--%");
      content = content.replace(/{{peso_perdido_total}}/g, "0 kg");
    }

    // Goal
    const currentDiet = await Dieta.findOne({ clienteId: cliente._id, isCurrent: true });
    content = content.replace(/{{objetivo_actual}}/g, currentDiet?.objetivo || "Bienestar");
  }
  
  // System variables
  const now = new Date();
  content = content.replace(/{{fecha}}/g, now.toLocaleDateString('es-ES'));
  content = content.replace(/{{hora}}/g, now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));


  if (action.type === 'SEND_EMAIL') {
    const to = cliente?.email || data.email;
    if (to) {
      await sendEmail({ to, subject, html: content });
      console.log(`[Automation] Email sent to ${to}`);
    }
  } else if (action.type === 'SEND_CHAT') {
    if (!cliente || !advisorId) return;

    await sendToChat(advisorId, cliente._id, content, action.buttons);
    console.log(`[Automation] Chat message sent to ${cliente.nombre}`);
  } else if (action.type === 'CREATE_TASK') {
    // Implement Task Creation
    const Task = require('../models/Tarea'); // Ensure you have this model
    if (!advisorId) return;

    const dueDateStr = action.metadata?.dueDate; 
    let dueDate = null; 
    
    // Simple relative date parsing (e.g., "+3d")
    if (dueDateStr && dueDateStr.startsWith('+')) {
       const days = parseInt(dueDateStr.replace('+','').replace('d','')) || 0;
       const d = new Date();
       d.setDate(d.getDate() + days);
       dueDate = d;
    }

    await Task.create({
       asesorId: advisorId,
       clienteId: cliente?._id,
       titulo: content, // Task title from content
       descripcion: `Tarea creada automáticamente por regla de automatización.`,
       fechaVencimiento: dueDate,
       estado: 'PENDIENTE'
    });
    console.log(`[Automation] Task created: ${content}`);

  } else if (action.type === 'ADD_TAG') {
      // Implement Add Tag
      if (!cliente) return;
      
      const tag = content.trim(); // Tag name from content
      if (tag && !cliente.etiquetas?.includes(tag)) {
         cliente.etiquetas = [...(cliente.etiquetas || []), tag];
         await cliente.save();
         console.log(`[Automation] Tag added to ${cliente.nombre}: ${tag}`);
      }

  } else if (action.type === 'SEND_PUSH_NOTIFICATION') {
      // Stub for Push Notification - requires WebPush configuration
      console.log(`[Automation] PUSH NOTIFICATION (Mock): ${content} to ${cliente?.nombre}`);
      // In a real implementation:
      // const subscription = await PushSubscription.findOne({ userId: cliente._id });
      // if (subscription) webpush.sendNotification(subscription, content);

  } else if (action.type === 'SEND_SMS') {
       // Stub for SMS - requires Twilio or similar
       console.log(`[Automation] SMS (Mock): ${content} to ${cliente?.telefono}`);
  } else if (action.type === 'SEND_SHOPPING_LIST') {
      if (cliente) {
        await handleSendShoppingList(action, cliente, advisorId);
      }
  } else if (action.type === 'AUTO_ADJUST_MACROS') {
      if (cliente) {
        const { suggestMacroAdjustment } = require('./intelligenceManager');
        const suggestion = await suggestMacroAdjustment(cliente._id);
        if (suggestion) {
          const Dieta = require('../models/Dieta');
          const currentDiet = await Dieta.findOne({ clienteId: cliente._id, isCurrent: true });
          if (currentDiet) {
            const newDietData = {
              ...currentDiet.toObject(),
              _id: undefined,
              macros: suggestion.suggestedMacros,
              rev: currentDiet.rev + 1,
              note: `Ajuste automático por estancamiento (${suggestion.objective})`,
              createdAt: undefined,
              updatedAt: undefined
            };
            currentDiet.isCurrent = false;
            await currentDiet.save();
            const newDiet = new Dieta(newDietData);
            await newDiet.save();
            console.log(`[Intelligence] Auto-adjusted macros for ${cliente.nombre}`);
          }
        }
      }
  } else if (action.type === 'SUGGEST_PROGRESSION') {
      if (cliente && data.registroId) {
        const { analyzeWorkoutProgression } = require('./intelligenceManager');
        const suggestions = await analyzeWorkoutProgression(data.registroId);
        if (suggestions.length > 0) {
          const Task = require('../models/Tarea');
          const suggestionText = suggestions.map(s => `• ${s.ejercicio}: ${s.suggestion} (${s.reason})`).join('\n');
          await Task.create({
            asesorId: advisorId,
            clienteId: cliente._id,
            titulo: `Sugerencia de Progresión: ${cliente.nombre}`,
            descripcion: `Basado en el último entrenamiento:\n${suggestionText}`,
            estado: 'PENDIENTE'
          });
          console.log(`[Intelligence] Progression suggestions created for ${cliente.nombre}`);
        }
      }
  }
}

/**
 * Logic to generate and send shopping list
 */
async function handleSendShoppingList(action, cliente, advisorId) {
    try {
        // 1. Get current diet
        const diet = await Dieta.findOne({ 
            clienteId: cliente._id, 
            isCurrent: true,
            estado: { $ne: 'archivada' }
        }).populate({
            path: "comidas.opciones.recetaId",
            populate: {
                path: "ingredientes.ingrediente",
                select: "nombre tipo",
            },
        }).populate("comidas.opciones.ingredienteId", "nombre tipo")
          .populate("comidas.opciones.items.ingredienteId", "nombre tipo")
          .lean();

        if (!diet) {
            console.log(`[Automation] No current diet found for ${cliente.nombre}. Skipping shopping list.`);
            return;
        }

        // 2. Aggregate ingredients
        const periodo = action.metadata?.periodo || 'semanal';
        let multiplier = periodo === 'mensual' ? 30 : 7;
        
        const ingredientsMap = {};
        diet.comidas.forEach(comida => {
            const numOptions = (comida.opciones && comida.opciones.length > 0) ? comida.opciones.length : 1;
            const optionMultiplier = multiplier / numOptions;

            comida.opciones.forEach(opcion => {
                if (opcion.tipo === 'ingrediente') {
                    const ing = opcion.ingredienteId;
                    const name = ing?.nombre || opcion.nombre;
                    const grams = (opcion.gramos || 0) * optionMultiplier;
                    const category = ing?.tipo || "General";
                    _aggregate(ingredientsMap, name, grams, category);
                } else if (opcion.tipo === 'combinacion') {
                    opcion.items.forEach(item => {
                        const ing = item.ingredienteId;
                        const name = ing?.nombre || item.nombre;
                        const grams = (item.gramos || 0) * optionMultiplier;
                        const category = ing?.tipo || "General";
                        _aggregate(ingredientsMap, name, grams, category);
                    });
                } else if (opcion.tipo === 'receta' && opcion.recetaId) {
                    opcion.recetaId.ingredientes.forEach(ri => {
                        const ing = ri.ingrediente;
                        const name = ing?.nombre || "Ingrediente Desconocido";
                        const grams = (ri.gramos || 0) * optionMultiplier;
                        const category = ing?.tipo || "General";
                        _aggregate(ingredientsMap, name, grams, category);
                    });
                }
            });
        });

        const ingredients = Object.values(ingredientsMap).sort((a, b) => a.category.localeCompare(b.category));
        if (ingredients.length === 0) return;

        // 3. Format Message
        let message = `🛒 *LISTA DE LA COMPRA (${periodo.toUpperCase()})*\n`;
        message += `Plan: ${diet.nombre}\n\n`;

        let currentCat = "";
        ingredients.forEach(ing => {
            if (ing.category !== currentCat) {
                currentCat = ing.category;
                message += `\n*${currentCat.toUpperCase()}*\n`;
            }
            const qty = _formatGrams(ing.grams);
            message += `• ${ing.name}: ${qty}\n`;
        });

        // 4. Send
        const channel = action.metadata?.channel || 'CHAT';
        if (channel === 'EMAIL' && cliente.email) {
            await sendEmail({
                to: cliente.email,
                subject: `Tu Lista de la Compra ${periodo === 'mensual' ? 'Mensual' : 'Semanal'}`,
                html: message.replace(/\n/g, '<br>').replace(/\*(.*?)\*/g, '<b>$1</b>')
            });
        } else {
            // Default to Chat
            await sendToChat(advisorId, cliente._id, message);
        }

        console.log(`[Automation] Shopping list sent to ${cliente.nombre} via ${channel}`);

    } catch (e) {
        console.error(`[Automation] Error in handleSendShoppingList:`, e);
    }
}

async function sendToChat(advisorId, clientId, text, buttons = []) {
    let conv = await Conversation.findOne({ asesorId: advisorId, clienteId: clientId });
    if (!conv) {
        conv = await Conversation.create({ asesorId: advisorId, clienteId: clientId, lastMessage: text, lastMessageAt: Date.now() });
    }

    const newMessage = new Message({
        conversationId: conv._id,
        senderType: 'ASESOR',
        senderId: advisorId,
        text: text,
        buttons: buttons
    });
    await newMessage.save();

    conv.lastMessage = text;
    conv.lastMessageAt = Date.now();
    if (!conv.unreadCounts) conv.unreadCounts = new Map();
    const currentCount = conv.unreadCounts.get(clientId.toString()) || 0;
    conv.unreadCounts.set(clientId.toString(), currentCount + 1);
    await conv.save();
}

function _aggregate(map, name, grams, category) {
    if (!name) return;
    if (!map[name]) map[name] = { name, grams: 0, category };
    map[name].grams += grams;
}

function _formatGrams(grams) {
    if (grams >= 1000) {
        const kg = grams / 1000;
        return `${kg.toFixed(kg % 1 === 0 ? 0 : 1)} kg`;
    }
    return `${Math.round(grams)} g`;
}

/**
 * Periodically check for scheduled automations and execute them
 */
async function processScheduledAutomations() {
  try {
    const now = new Date();
    const currentDay = now.getDay(); // 0 (Sun) to 6 (Sat)
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // 1. One-time scheduled automations
    const oneTimeAutomations = await Automation.find({
      type: 'SCHEDULED',
      active: true,
      scheduledDate: { $lte: now },
      daysOfWeek: { $size: 0 } // Not weekly
    }).populate('actions.templateId');

    // 2. Weekly recurring automations
    const weeklyAutomations = await Automation.find({
      type: 'SCHEDULED',
      active: true,
      daysOfWeek: { $in: [currentDay] }
    }).populate('actions.templateId');

    const allDueAutomations = [...oneTimeAutomations];

    for (const auto of weeklyAutomations) {
      // Check if already executed today
      if (auto.lastExecutedAt) {
        const lastExec = new Date(auto.lastExecutedAt);
        if (lastExec.toDateString() === now.toDateString()) continue;
      }

      // Check time
      if (auto.hour < currentHour || (auto.hour === currentHour && auto.minute <= currentMinute)) {
        allDueAutomations.push(auto);
      }
    }

    for (const automation of allDueAutomations) {
      console.log(`[Automation] Processing due rule: ${automation.name} (${automation.type})`);
      
      let targetClients = [];
      if (automation.allClients) {
        targetClients = await Cliente.find({ asesorId: automation.advisorId });
      } else if (automation.targetClientIds && automation.targetClientIds.length > 0) {
        targetClients = await Cliente.find({ _id: { $in: automation.targetClientIds } });
      }

      for (const cliente of targetClients) {
        for (const action of automation.actions) {
          await executeAction(action, { 
            cliente, 
            advisorId: automation.advisorId, 
            data: { email: cliente.email } 
          });
        }
      }

      if (automation.daysOfWeek && automation.daysOfWeek.length > 0) {
        // Recurring: just update timestamp
        automation.lastExecutedAt = now;
      } else {
        // One-time: deactivate
        automation.active = false;
      }
      
      await automation.save();
      console.log(`[Automation] Rule ${automation.name} executed.`);
    }

    // --- NEW DAILY TRIGGERS LOGIC ---
    // Run this block ideally once a day (or check if already ran today)
    // For simplicity, we check if hour == 9 (9 AM) and minute < 15 to run checking
    if (currentHour === 9 && currentMinute < 15) {
       await checkDailyTriggers(now);
    }

  } catch (e) {
    console.error('[Automation] Error processing scheduled automations:', e);
  }
}

/**
 * Checks for daily-based triggers like Birthday, Plan Expiration, etc.
 */
async function checkDailyTriggers(today) {
    console.log('[Automation] Checking daily triggers...');
    
    // 1. Get all active event-based automations concerning dates
    const dailyAutomations = await Automation.find({
        active: true,
        type: 'EVENT',
        trigger: { $in: ['PLAN_EXPIRED', 'BIRTHDAY', 'INACTIVE_7_DAYS', 'PLAN_EXPIRING_3_DAYS', 'PROGRESS_STALLED', 'INACTIVE_3_DAYS', 'INACTIVE_5_DAYS', 'WEIGHT_GOAL_REACHED', 'STREAK_7_DAYS'] }
    }).populate('actions.templateId');

    if (dailyAutomations.length === 0) return;

    // 2. Fetch all clients to check conditions
    // Optimization: In a real app, query only relevant clients from DB instead of JS filtering
    const allClients = await Cliente.find({ estado: 'Activo' });

    for (const auto of dailyAutomations) {
        
        let targetClients = [];
        if (auto.allClients) {
            targetClients = allClients.filter(c => c.asesorId && c.asesorId.toString() === auto.advisorId.toString());
        } else {
            targetClients = allClients.filter(c => auto.targetClientIds.some(id => id.toString() === c._id.toString()));
        }

        for (const client of targetClients) {
             let shouldTrigger = false;

             // Rule: BIRTHDAY
             if (auto.trigger === 'BIRTHDAY' && client.fechaNacimiento) {
                 const dob = new Date(client.fechaNacimiento);
                 if (dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth()) {
                     shouldTrigger = true;
                 }
             }

             // Rule: PLAN_EXPIRED
             if (auto.trigger === 'PLAN_EXPIRED' && client.fechaFin) {
                 // Check if expired yesterday/today
                 const expiry = new Date(client.fechaFin);
                 // Normalize to start of day
                 const t = new Date(today); t.setHours(0,0,0,0);
                 const e = new Date(expiry); e.setHours(0,0,0,0);
                 
                 // Trigger if expiry matches today (or yesterday if strict)
                 if (e.getTime() === t.getTime()) {
                     shouldTrigger = true;
                 }
             }

             // Rule: INACTIVE_7_DAYS
             if (auto.trigger === 'INACTIVE_7_DAYS') {
                 // Requires 'lastLogin' or similar field. Assuming 'ultimaActividad' exists or using 'updatedAt' fallback
                 const lastActive = client.ultimaActividad ? new Date(client.ultimaActividad) : new Date(client.updatedAt);
                 const diffTime = Math.abs(today - lastActive);
                 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                 if (diffDays === 7) {
                     shouldTrigger = true;
                 }
             }

              // Rule: INACTIVE_3_DAYS or INACTIVE_5_DAYS
              if (auto.trigger === 'INACTIVE_3_DAYS' || auto.trigger === 'INACTIVE_5_DAYS') {
                  const targetDays = auto.trigger === 'INACTIVE_3_DAYS' ? 3 : 5;
                  const lastActive = client.ultimaActividad ? new Date(client.ultimaActividad) : new Date(client.updatedAt);
                  const diffTime = Math.abs(today - lastActive);
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                  if (diffDays === targetDays) {
                      shouldTrigger = true;
                  }
              }

              // Rule: WEIGHT_GOAL_REACHED
              if (auto.trigger === 'WEIGHT_GOAL_REACHED' && client.pesoObjetivo) {
                  const latestRecord = client.historialProgreso?.[0];
                  if (latestRecord && latestRecord.peso <= client.pesoObjetivo) {
                      // Only trigger if achieved today (roughly) or not already triggered
                      // For simplicity, we trigger if the date of record is today
                      const recordDate = new Date(latestRecord.fecha);
                      if (recordDate.toDateString() === today.toDateString()) {
                          shouldTrigger = true;
                      }
                  }
              }

              // Rule: STREAK_7_DAYS
              if (auto.trigger === 'STREAK_7_DAYS') {
                  const EntrenamientoRegistro = require('../models/EntrenamientoRegistro');
                  const sevenDaysAgo = new Date(today);
                  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                  
                  const registros = await EntrenamientoRegistro.find({
                      clienteId: client._id,
                      fecha: { $gte: sevenDaysAgo }
                  });

                  // Check if there is at least one record for each of the last 7 days
                  const distinctDays = new Set(registros.map(r => new Date(r.fecha).toDateString()));
                  if (distinctDays.size >= 7) {
                      shouldTrigger = true;
                  }
              }

             // Rule: PROGRESS_STALLED
             if (auto.trigger === 'PROGRESS_STALLED') {
                 const { analyzeStall } = require('./intelligenceManager');
                 const stall = await analyzeStall(client._id);
                 if (stall) {
                     shouldTrigger = true;
                 }
             }

             if (shouldTrigger) {
                 // Final check: Automation conditions (tags, goals, etc)
                 if (auto.conditions && Object.keys(auto.conditions).length > 0) {
                    if (!evaluateConditions(auto.conditions, client)) {
                        shouldTrigger = false;
                    }
                 }
             }

             if (shouldTrigger) {
                 console.log(`[Automation] Triggering ${auto.trigger} for ${client.nombre}`);
                 for (const action of auto.actions) {
                    await executeAction(action, { 
                        cliente: client, 
                        advisorId: auto.advisorId, 
                        data: { event: auto.trigger } 
                    });
                 }
                 // Optional: Limit frequency to avoid duplicate triggers if cron runs multiple times
             }
        }
    }


}

/**
 * Logic to evaluate if a client meets automation conditions
 */
function evaluateConditions(conditions, cliente) {
    if (!cliente || !conditions || !conditions.rules) return true;
    
    const operator = conditions.operator || 'AND';
    const rules = conditions.rules;

    const results = rules.map(rule => {
        const { field, operator: op, value } = rule;
        let clientValue;

        if (field === 'tag') {
            clientValue = cliente.etiquetas || [];
            if (op === 'contains') return clientValue.includes(value);
            if (op === 'not_contains') return !clientValue.includes(value);
            return true;
        }

        if (field === 'objetivo') {
            clientValue = cliente.historialProgreso?.[0]?.objetivo; // or from current diet
            // For now, let's assume it's passed in metadata or we check current diet
            return true; // Simplify for now
        }

        if (field === 'genero') {
            clientValue = cliente.genero;
            if (op === 'equals') return clientValue === value;
            return true;
        }

        return true;
    });

    if (operator === 'AND') return results.every(r => r === true);
    if (operator === 'OR') return results.some(r => r === true);
    
    return true;
}

async function processScheduledTasks() {
    try {
        const now = new Date();
        const tasks = await ScheduledTask.find({
            status: 'PENDING',
            executeAt: { $lte: now }
        });

        if (tasks.length === 0) return;

        console.log(`[Automation] Processing ${tasks.length} ready delayed tasks...`);

        for (const task of tasks) {
            try {
                const cliente = task.clientId ? await Cliente.findById(task.clientId) : null;
                await executeAction(task.action, { 
                    cliente, 
                    advisorId: task.advisorId, 
                    data: task.triggerData || {} 
                });

                task.status = 'COMPLETED';
                await task.save();
            } catch (err) {
                console.error(`[Automation] Error executing delayed task ${task._id}:`, err);
                task.status = 'FAILED';
                task.error = err.message;
                await task.save();
            }
        }
    } catch (e) {
        console.error('[Automation] Error processing scheduled tasks:', e);
    }
}

module.exports = { 
    triggerAutomations, 
    processScheduledAutomations,
    processScheduledTasks 
};
