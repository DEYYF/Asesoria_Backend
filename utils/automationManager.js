const Automation = require('../models/Automation');
const Template = require('../models/Template');
const Cliente = require('../models/Cliente');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
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
  }
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

  } catch (e) {
    console.error('[Automation] Error processing scheduled automations:', e);
  }
}

module.exports = { triggerAutomations, processScheduledAutomations };
