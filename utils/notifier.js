// notifier.js
require("dotenv").config();

const mongoose = require("mongoose");
const transporter = require("../services/mailer");

// MODELOS (ajusta rutas si hace falta)
const Cliente = require("../models/Cliente");
const Cita = require("../models/Cita");

// ————— Helpers —————
async function ensureMongo() {
  if (mongoose.connection.readyState !== 0) return;
  const uri = process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!uri) {
    console.warn("[notifier] Falta MONGO_URI/DATABASE_URL/MONGODB_URI");
    return;
  }
  await mongoose.connect(uri);
  console.log("[notifier] Conectado a Mongo");
}

const TZ = "Europe/Madrid";
function dateISOInTZ(daysOffset = 0, tz = TZ) {
  const target = new Date(Date.now() + daysOffset * 86400000);
  // en-CA => YYYY-MM-DD
  return target.toLocaleDateString("en-CA", { timeZone: tz });
}

const getClienteEmail = (cli) => cli?.email || cli?.correo || cli?.destinatario || null;

async function sendEmail({ to, subject, text, html, attachments }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("Falta remitente (SMTP_FROM o SMTP_USER)");
  return transporter.sendMail({
    from,
    to,
    subject,
    ...(html ? { html } : { text: text || "" }),
    ...(attachments ? { attachments } : {}),
  });
}

// ————— Recordatorios genéricos por offset —————
// daysOffset = 0 -> citas de HOY (mensaje “hoy”)
// daysOffset = 1 -> citas de MAÑANA (mensaje “mañana”)
async function processRemindersForOffset(daysOffset = 0) {
  await ensureMongo();
  const target = dateISOInTZ(daysOffset);

  const citas = await Cita.find({
    $or: [{ date: target }, { fecha: target }],
  }).lean();

  const whenWord = daysOffset === 0 ? "hoy" : daysOffset === 1 ? "mañana" : `el ${target}`;
  let count = 0;

  for (const c of citas) {
    const cliente = await Cliente.findById(c.clienteId || c.idCliente).lean();
    const to = getClienteEmail(cliente);
    if (!to) continue;

    // Obtener asesor para buscar template
    const asesorId = cliente?.asesorId || c.asesorId;
    
    if (asesorId) {
        const { sendTemplateEmail } = require('./emailTemplates');
        await sendTemplateEmail(asesorId, 'citaReminder', to, {
            clienteNombre: cliente?.nombre || 'Cliente',
            titulo: c.asunto || c.titulo || 'Cita',
            fecha: target,
            hora: c.hora || c.hour || c.time || 'N/A'
        });
    } else {
        // Fallback si no hay asesor (legacy)
        const hora = c.hora || c.hour || c.time || "";
        const asunto = (c.asunto || c.titulo || `Recordatorio de cita ${whenWord}`).trim();
        const texto = c.mensaje || `Hola ${cliente?.nombre || ""}, recuerda tu cita ${whenWord}${hora ? ` a las ${hora}` : ""}.`;

        await sendEmail({
            to,
            subject: asunto + (daysOffset === 1 && !/mañana/i.test(asunto) ? " (mañana)" : ""),
            text: texto,
        });
    }
    
    count++;
  }

  console.log(`[notifier] Recordatorios (${whenWord}) enviados. Total: ${count}`);
  return count;
}

// ————— Wrappers cómodos —————
async function processReminders() {
  // hoy
  return processRemindersForOffset(0);
}

async function processRemindersDayBefore() {
  // citas de MAÑANA ⇒ recordatorio el día de antes
  return processRemindersForOffset(1);
}

// ————— Resumen diario —————
async function sendDailySummary() {
  await ensureMongo();
  const hoy = dateISOInTZ(0);

  const citas = await Cita.find({ $or: [{ date: hoy }, { fecha: hoy }] })
    .sort({ hora: 1, hour: 1 })
    .lean();

  const lines = [
    `Resumen diario (${hoy})`,
    `Citas hoy: ${citas.length}`,
    ...citas.map((c) => `- ${c.hora || c.hour || ""} · ${c.titulo || c.asunto || "Cita"} · ${c._id}`),
  ];

  const to = process.env.SUMMARY_TO;
  if (!to) return console.warn("[notifier] Falta SUMMARY_TO");
  await sendEmail({
    to,
    subject: `Resumen diario - ${hoy}`,
    text: lines.join("\n"),
  });
  console.log("[notifier] Resumen diario enviado a", to);
}

module.exports = {
  processReminders,           // mismo día
  processRemindersDayBefore,  // día anterior (para citas de mañana)
  sendDailySummary,
  sendEmail,
};


if (require.main === module) {
  const cmd = (process.argv[2] || "").toLowerCase();
  (async () => {
    try {
      if (cmd === "reminders") {
        await processReminders();
      } else if (cmd === "reminders-1d") {
        await processRemindersDayBefore();
      } else if (cmd === "summary") {
        await sendDailySummary();
      } else {
        console.log("Uso:");
        console.log("  node notifier.js reminders      # envía recordatorios de HOY");
        console.log("  node notifier.js reminders-1d   # envía recordatorios del DÍA ANTERIOR (citas de mañana)");
        console.log("  node notifier.js summary        # envía resumen diario de HOY");
      }
    } catch (e) {
      console.error("[notifier] Falló:", e?.message || e);
      process.exitCode = 1;
    } finally {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
    }
  })();
}
