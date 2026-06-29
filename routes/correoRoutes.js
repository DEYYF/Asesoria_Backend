const express = require("express");
const router = express.Router();
const { sendEmail } = require("../utils/notifier");
const CorreoLog = require("../models/CorreoLog");

// util min
const isEmail = (v) => typeof v === "string" && /\S+@\S+\.\S+/.test(v);

router.post("/enviar", async (req, res) => {
  try {
    // Soporta nombres antiguos y nuevos
    const {
      to: toRaw, email, para, destinatario, Destinatario,
      subject: subjectRaw, asunto, Asunto,
      text, mensaje, Mensaje, html,
      Adjuntos, attachments: attachmentsRaw,
      Formulario,
      asesorId, clienteId, // llegan pero no son obligatorios
    } = req.body || {};

    const to = toRaw || email || para || destinatario || Destinatario;
    const subject = (subjectRaw || asunto || Asunto || "").toString().trim();
    const bodyContent = html || Mensaje || mensaje || text || "";

    if (!to) throw new Error("Falta campo: to/destinatario");
    if (!isEmail(to)) throw new Error("Campo 'to/destinatario' no es un email válido");
    if (!subject) throw new Error("Falta campo: subject/asunto");

    // Mapear adjuntos: acepta formato nuevo (Adjuntos) o legacy (attachments)
    let adjuntos = [];
    if (Adjuntos && Array.isArray(Adjuntos)) {
      adjuntos = Adjuntos.map(a => ({
        file_name: a.file_name || a.filename || "adjunto",
        file_url: a.file_url || "",
        filename: a.filename || a.file_name || "adjunto",
        data: a.data || a.content || ""
      }));
    } else if (attachmentsRaw && Array.isArray(attachmentsRaw)) {
      adjuntos = attachmentsRaw.map(a => ({
        file_name: a.file_name || a.filename || "adjunto",
        file_url: a.file_url || "",
        filename: a.filename || a.file_name || "adjunto",
        data: a.data || a.content || ""
      }));
    }

    // Determinar si la factura está pagada (si se pasa explícitamente en el body)
    const facturaPagada = Formulario === true;

    // Enviar via Make.com webhook
    const info = await sendEmail({
      to,
      subject,
      text: bodyContent,
      facturaPagada,
      attachments: adjuntos,
    });

    // ARCHIVAR EN LOG
    try {
      if (asesorId) {
        await CorreoLog.create({
          emisorId: asesorId,
          clienteId: clienteId || null,
          destinatario: to,
          asunto: subject,
          mensaje: bodyContent,
          estado: 'Enviado',
          attachments: adjuntos.map(a => ({
            filename: a.file_name || 'adjunto',
          }))
        });
      }
    } catch (logErr) {
      console.error("[correoRoutes] Error al guardar log:", logErr);
    }

    return res.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    console.error("[correoRoutes] Error:", err?.message || err);
    return res.status(400).json({ ok: false, error: String(err?.message || err) });
  }
});

// Obtener historial de correos de un asesor
router.get("/historial/:asesorId", async (req, res) => {
  try {
    const { asesorId } = req.params;
    const { clienteId, limit = 50, page = 1 } = req.query;

    const query = { emisorId: asesorId };
    if (clienteId) query.clienteId = clienteId;

    const logs = await CorreoLog.find(query)
      .sort({ fecha: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('clienteId', 'nombre email');

    const total = await CorreoLog.countDocuments(query);

    res.json({
      ok: true,
      data: logs,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
