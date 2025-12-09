const express = require("express");
const router = express.Router();
const transporter = require("../services/mailer");

// util min
const isEmail = (v) => typeof v === "string" && /\S+@\S+\.\S+/.test(v);

router.post("/enviar", async (req, res) => {
  try {
    // Soporta nombres antiguos y nuevos
    const {
      to: toRaw, email, para, destinatario,
      subject: subjectRaw, asunto,
      text, mensaje, html,
      cc, bcc, replyTo,
      attachments, // Nuevo campo para adjuntos
      asesorId, clienteId, // llegan pero no son obligatorios
    } = req.body || {};

    const to = toRaw || email || para || destinatario;
    const subject = (subjectRaw || asunto || "").toString().trim();

    // Prioriza HTML explícito; si no, decide según contenido
    const bodyHtml = html ?? (typeof mensaje === "string" && mensaje.includes("<") ? mensaje : undefined);
    const bodyText = text ?? (bodyHtml ? undefined : (mensaje || ""));

    if (!to) throw new Error("Falta campo: to/destinatario");
    if (!isEmail(to)) throw new Error("Campo 'to/destinatario' no es un email válido");
    if (!subject) throw new Error("Falta campo: subject/asunto");

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    if (!from) throw new Error("Falta remitente (SMTP_FROM o SMTP_USER)");

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      ...(replyTo ? { replyTo } : {}),
      ...(cc ? { cc } : {}),
      ...(bcc ? { bcc } : {}),
      ...(bodyHtml ? { html: bodyHtml } : { text: bodyText || "" }),
      attachments, // Pasamos los adjuntos a nodemailer
      // Puedes adjuntar metadatos en headers si quieres rastreo:
      headers: {
        "X-Asesor-Id": asesorId ?? "",
        "X-Cliente-Id": clienteId ?? "",
      },
    });

    return res.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    console.error("[correoRoutes] Error:", err?.message || err);
    return res.status(400).json({ ok: false, error: String(err?.message || err) });
  }
});

module.exports = router;
