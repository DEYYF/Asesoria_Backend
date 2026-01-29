const Usuario = require('../models/Usuario');
const { sendEmail } = require('./notifier');

/**
 * Sends an email using a user-configured template.
 * @param {string} advisorId - The ID of the advisor (Usuario) who owns the settings.
 * @param {string} type - The template type ('citaCreated', 'citaUpdated', 'citaReminder').
 * @param {string} recipientEmail - The recipient's email address.
 * @param {object} context - Key-value pairs to replace in the template (e.g., { clienteNombre: 'Juan', fecha: '...' }).
 */
const sendTemplateEmail = async (advisorId, type, recipientEmail, context) => {
  try {
    if (!recipientEmail) {
        console.warn('[emailTemplates] No recipient email provided.');
        return;
    }

    const advisor = await Usuario.findById(advisorId);
    if (!advisor) {
      console.error(`[emailTemplates] Advisor not found: ${advisorId}`);
      return;
    }

    // Default templates (fallback)
    const defaults = {
        citaCreated: {
            subject: 'Nueva Cita Agendada',
            body: 'Hola {{clienteNombre}},\n\nSe ha agendado una nueva cita:\n\nTítulo: {{titulo}}\nFecha: {{fecha}}\nHora: {{hora}}\n\nSaludos,\n{{asesorNombre}}'
        },
        citaUpdated: {
            subject: 'Cita Modificada',
            body: 'Hola {{clienteNombre}},\n\nTu cita ha sido modificada:\n\nTítulo: {{titulo}}\nNueva Fecha: {{fecha}}\nNueva Hora: {{hora}}\n\nSaludos,\n{{asesorNombre}}'
        },
        citaReminder: {
            subject: 'Recordatorio de Cita',
            body: 'Hola {{clienteNombre}},\n\nRecuerda que tienes una cita programada:\n\nTítulo: {{titulo}}\nFecha: {{fecha}}\nHora: {{hora}}\n\nTe esperamos.'
        }
    };

    // Get configured template or fallback
    let templateConfig = advisor.settings?.emailTemplates?.[type];
    
    // If not configured in DB yet, use default structure but respect "enabled" if it existed (edge case)
    if (!templateConfig) {
        templateConfig = { ...defaults[type], enabled: true };
    }

    if (templateConfig.enabled === false) {
      console.log(`[emailTemplates] Email type '${type}' is disabled for advisor ${advisorId}.`);
      return;
    }

    let subject = templateConfig.subject || defaults[type].subject;
    let body = templateConfig.body || defaults[type].body;

    // Add advisor name to context if not present
    if (!context.asesorNombre) {
        context.asesorNombre = advisor.nombre;
    }

    // Replace placeholders
    Object.keys(context).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      const val = context[key] || '';
      subject = subject.replace(regex, val);
      body = body.replace(regex, val);
    });

    // Send
    await sendEmail({
      to: recipientEmail,
      subject: subject,
      text: body
    });

    console.log(`[emailTemplates] Sent '${type}' email to ${recipientEmail}`);

  } catch (error) {
    console.error('[emailTemplates] Error sending template email:', error);
  }
};

module.exports = { sendTemplateEmail };
