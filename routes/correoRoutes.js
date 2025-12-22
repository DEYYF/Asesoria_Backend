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

    // Fetch user settings if asesorId is provided
    let signature = "";
    let signatureImageUrl = "";
    let customFrom = "";
    if (asesorId) {
      const Usuario = require("../models/Usuario");
      const user = await Usuario.findById(asesorId).select("settings");
      if (user && user.settings) {
        signature = user.settings.emailSignature || "";
        signatureImageUrl = user.settings.signatureImageUrl || "";
        customFrom = user.settings.businessEmail || "";
      }
    }

    // Prioriza HTML explícito; si no, decide según contenido
    let bodyHtml = html ?? (typeof mensaje === "string" && mensaje.includes("<") ? mensaje : undefined);
    let bodyText = text ?? (bodyHtml ? undefined : (mensaje || ""));

    // Append signature if exists
    if (signature || signatureImageUrl) {
      if (bodyHtml) {
        let sigHtml = `<br><br><div style="color: #666; font-size: 14px; border-top: 1px solid #eee; padding-top: 10px;">`;
        if (signatureImageUrl) {
          sigHtml += `<img src="${signatureImageUrl}" alt="Firma" style="max-width: 200px; max-height: 100px; display: block; margin-bottom: 8px;"><br>`;
        }
        if (signature) {
          sigHtml += signature.replace(/\n/g, "<br>");
        }
        sigHtml += `</div>`;
        bodyHtml += sigHtml;
      } else {
        bodyText += `\n\n--\n${signature}`;
        if (signatureImageUrl) {
          bodyText += `\n[Imagen: ${signatureImageUrl}]`;
        }
      }
    }

    if (!to) throw new Error("Falta campo: to/destinatario");
    if (!isEmail(to)) throw new Error("Campo 'to/destinatario' no es un email válido");
    if (!subject) throw new Error("Falta campo: subject/asunto");

    const defaultFrom = process.env.SMTP_FROM || process.env.SMTP_USER;
    if (!defaultFrom) throw new Error("Falta remitente (SMTP_FROM o SMTP_USER)");

    // Use corporate email if available, otherwise default
    const from = customFrom || defaultFrom;

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
