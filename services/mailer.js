const nodemailer = require("nodemailer");

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE =
  process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : true;

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.warn(
    "[mailer] Falta SMTP_USER/SMTP_PASS en .env (recomendado App Password si usas Gmail)."
  );
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify().then(
  () => console.log("[mailer] SMTP listo."),
  (err) => console.error("[mailer] SMTP no disponible:", err?.message || err)
);

module.exports = transporter;
