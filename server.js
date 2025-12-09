require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const authMiddleware = require('./middlewares/authMiddleware');

const app = express();

/* ───────── Seguridad base ───────── */
app.set('trust proxy', 1); // si hay proxy (nginx/render)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // si sirves imágenes/avatars
}));

// Compresión gzip para todas las respuestas (60-80% reducción de tamaño)
app.use(compression());

// Limitar tamaño de payload
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// CORS + logs
app.use(cors({ origin: true, credentials: true }));
app.use(morgan("dev"));

// Rate limiting basado en usuario (no IP) para endpoints autenticados
// Solo activo en producción, deshabilitado en desarrollo
if (process.env.NODE_ENV === 'production') {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // Por usuario autenticado
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    // Usar userId del token JWT en lugar de IP
    keyGenerator: (req) => {
      // Intentar extraer userId del token
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          return `user_${decoded.userId}`; // Límite por usuario
        } catch (err) {
          // Token inválido, usar IP
          return req.ip;
        }
      }
      return req.ip; // Sin token, usar IP
    },
  });
  app.use("/api", apiLimiter);

  // Rate limit más estricto para auth (anti-bruteforce) - por IP
  const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 50, // Por IP para prevenir ataques
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: false,
    message: { error: 'Demasiados intentos de login. Intenta de nuevo más tarde.' }
  });
  app.use("/api/auth", authLimiter);
  
  console.log('✅ Rate limiting ACTIVO (producción)');
} else {
  console.log('⚠️  Rate limiting DESHABILITADO (desarrollo)');
}

/* ───────── Rutas ───────── */
app.get("/api/health", (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.use('/api/entrenamientos', require('./routes/entrenamientoRoutes'));
app.use('/api/ejercicios', require('./routes/ejerciciosRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/usuarios', require('./routes/userRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/dietas', require('./routes/dietas'));
app.use('/api/clientes', require('./routes/clientRoutes'));
app.use('/api/comidas', require('./routes/comidasRoutes'));
app.use('/api/movimientos', require('./routes/movimientoRoutes'));
app.use('/api/correo', require('./routes/correoRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/citas', require('./routes/citasRoutes'));
app.use('/api/tareas', require('./routes/TareasRoutes'));
app.use("/api/tarifas", require("./routes/tarifas"));
app.use("/api/extras", require("./routes/extras"));
app.use("/api/presupuestos", require("./routes/presupuestos"));


/* 404 explícito */
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

/* Manejador de errores central */
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({ error: err.message || "Internal error" });
});

/* ───────── DB + Arranque ───────── */
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Conectado a MongoDB');
  app.listen(process.env.PORT || 4000, () => console.log('Servidor iniciado'));
}).catch(err => console.error(err));

/* ───────── CRON (tus recordatorios) ───────── */
const cron = require("node-cron");
const { processReminders, sendDailySummary } = require("./utils/notifier");

// Recordatorios cada 15 min
cron.schedule("*/15 * * * *", () => processReminders());

// Resumen diario 08:00 Europe/Madrid
cron.schedule("0 8 * * *", () => sendDailySummary(), { timezone: "Europe/Madrid" });
