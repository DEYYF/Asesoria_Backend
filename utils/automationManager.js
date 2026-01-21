const Automation = require('../models/Automation');
const Template = require('../models/Template');
const Cliente = require('../models/Cliente');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Dieta = require('../models/Dieta');
const { sendEmail } = require('./notifier');

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
      // TODO: Check conditions if any
      
      for (const action of automation.actions) {
        if (action.delay > 0) {
          // TODO: Schedule delayed action
          console.log(`[Automation] Scheduling delayed action (${action.delay}m) for ${trigger}`);
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

    // Find or create conversation
    let conv = await Conversation.findOne({
      asesorId: advisorId,
      clienteId: cliente._id
    });

    if (!conv) {
      conv = await Conversation.create({
        asesorId: advisorId,
        clienteId: cliente._id,
        lastMessage: content,
        lastMessageAt: Date.now()
      });
    }

    const newMessage = new Message({
      conversationId: conv._id,
      senderType: 'ASESOR',
      senderId: advisorId,
      text: content
    });

    await newMessage.save();
    
    conv.lastMessage = content;
    conv.lastMessageAt = Date.now();
    
    // Update unread count for client
    if (!conv.unreadCounts) conv.unreadCounts = new Map();
    const currentCount = conv.unreadCounts.get(cliente._id.toString()) || 0;
    conv.unreadCounts.set(cliente._id.toString(), currentCount + 1);
    
    await conv.save();
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
      if (!cliente) return;
      await handleSendShoppingList(action, cliente, advisorId);
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

async function sendToChat(advisorId, clientId, text) {
    let conv = await Conversation.findOne({ asesorId: advisorId, clienteId: clientId });
    if (!conv) {
        conv = await Conversation.create({ asesorId: advisorId, clienteId: clientId, lastMessage: text, lastMessageAt: Date.now() });
    }

    const newMessage = new Message({
        conversationId: conv._id,
        senderType: 'ASESOR',
        senderId: advisorId,
        text: text
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
        trigger: { $in: ['PLAN_EXPIRED', 'BIRTHDAY', 'INACTIVE_7_DAYS', 'PLAN_EXPIRING_3_DAYS'] }
    }).populate('actions.templateId');

    if (dailyAutomations.length === 0) return;

    // 2. Fetch all clients to check conditions
    // Optimization: In a real app, query only relevant clients from DB instead of JS filtering
    const allClients = await Cliente.find({ estado: 'Activo' });

    for (const auto of dailyAutomations) {
        
        let targetClients = [];
        if (auto.allClients) {
            targetClients = allClients.filter(c => c.asesorId === auto.advisorId);
        } else {
            targetClients = allClients.filter(c => auto.targetClientIds.includes(c._id.toString()));
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

module.exports = { triggerAutomations, processScheduledAutomations };
