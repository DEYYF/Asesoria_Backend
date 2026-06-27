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

const allowedOrigins = [
  'http://localhost:4000',
  'http://localhost:3000',
  'http://localhost:5500', 
  'http://127.0.0.1:5500',
  'https://asesoria-app-rouge.vercel.app'
];

// CORS + logs
app.use(cors({
  origin: function (origin, callback) {
    // Permitir si no hay origen (postman, s2s) o si está en la lista permitida
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Fallback: si necesitas bloquear de verdad, cambia a "callback(new Error('CORS no permitido'));"
    }
  },
  credentials: true
}));
app.use(morgan("dev"));

// Rate limiting basado en usuario (no IP) para endpoints autenticados
// Solo activo en producción, deshabilitado en desarrollo
if (process.env.NODE_ENV === 'production') {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    keyGenerator: (req) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          return `user_${decoded.id || decoded.userId || decoded._id}`;
        } catch (err) {
          return req.ip;
        }
      }
      return req.ip;
    },
  });
  app.use("/api", apiLimiter);

  const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
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
app.use('/api/users', require('./routes/userRoutes'));
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
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/templates', require('./routes/templateRoutes'));
app.use('/api/automations', require('./routes/automationRoutes'));
app.use('/api/finanzas', require('./routes/finanzasRoutes'));
app.use('/api/facturas', require('./routes/facturaRoutes'));
app.use('/api/google-calendar', require('./routes/googleCalendarRoutes'));
app.use('/api/despensa', require('./routes/despensa'));
app.use('/api/smart-insights', require('./routes/smartInsightsRoutes'));
app.use('/api/gamification', require('./routes/gamificationRoutes'));



/* 404 explícito */
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

/* Manejador de errores central */
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({ error: err.message || "Internal error" });
});

const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});
app.set('io', io);

// Socket.io Middleware for Auth
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  if (!token) return next(new Error('Authentication error'));
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    // Normalize user object for socket logic
    socket.user = {
      userId: decoded.id,
      role: decoded.type === 'client' ? 'cliente' : 'asesor'
    };
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.userId}`);
  
  // Join a room based on userId to receive private events
  socket.join(socket.user.userId);

  socket.on('sendMessage', async (data) => {
    try {
      const { conversationId, text } = data;
      console.log('sendMessage received:', { conversationId, text, userId: socket.user.userId, role: socket.user.role });

      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation) {
        console.log('Conversation not found:', conversationId);
        return;
      }
      console.log('Conversation found:', { 
        id: conversation._id, 
        asesorId: conversation.asesorId, 
        clienteId: conversation.clienteId, 
        recipientAsesorId: conversation.recipientAsesorId 
      });

      // Validate sender is part of conversation
      const isAsesor = conversation.asesorId && conversation.asesorId.toString() === socket.user.userId;
      const isClient = conversation.clienteId && conversation.clienteId.toString() === socket.user.userId;
      const isRecipientAsesor = conversation.recipientAsesorId && conversation.recipientAsesorId.toString() === socket.user.userId;

      console.log('Participant check:', { isAsesor, isClient, isRecipientAsesor });

      if (!isAsesor && !isClient && !isRecipientAsesor) {
        console.log('Sender not part of conversation');
        return;
      }

      const senderType = socket.user.role === 'asesor' ? 'ASESOR' : 'CLIENTE';
      const newMessage = new Message({
        conversationId,
        senderType,
        senderId: socket.user.userId,
        text
      });

      await newMessage.save();
      console.log('Message saved:', newMessage._id);
      
      // Update lastMessage and unreadCounts
      conversation.lastMessage = text;
      conversation.lastMessageAt = Date.now();

      // Initialize unreadCounts if missing
      if (!conversation.unreadCounts) {
        conversation.unreadCounts = new Map();
      }

      // Identify recipients (everyone involved who is NOT the sender)
      const participants = [
        conversation.asesorId?.toString(),
        conversation.clienteId?.toString(),
        conversation.recipientAsesorId?.toString()
      ].filter(id => id && id !== socket.user.userId);

      // Increment unread count for each recipient
      participants.forEach(recipientId => {
        const currentCount = conversation.unreadCounts.get(recipientId) || 0;
        conversation.unreadCounts.set(recipientId, currentCount + 1);
      });

      console.log('Updating conversation:', { 
        lastMessage: text, 
        unreadCounts: Object.fromEntries(conversation.unreadCounts) 
      });

      await conversation.save();

      // Emit to ALL participants
      if (conversation.asesorId) io.to(conversation.asesorId.toString()).emit('receiveMessage', newMessage);
      if (conversation.clienteId) io.to(conversation.clienteId.toString()).emit('receiveMessage', newMessage);
      if (conversation.recipientAsesorId) io.to(conversation.recipientAsesorId.toString()).emit('receiveMessage', newMessage);
      
    } catch (err) {
      console.error('Socket error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.userId}`);
  });
});

/* ───────── DB + Arranque ───────── */
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Conectado a MongoDB');
  server.listen(process.env.PORT || 4000, () => console.log('Servidor iniciado con Socket.io'));
}).catch(err => console.error(err));

/* ───────── CRON (tus recordatorios) ───────── */
const cron = require("node-cron");
const { processReminders, sendDailySummary } = require("./utils/notifier");
const { processScheduledAutomations, processScheduledTasks } = require("./utils/automationManager");

// Automatizaciones programadas (diarias/semanales) cada 5 min
cron.schedule("*/5 * * * *", () => {
  processScheduledAutomations();
});

// Tareas con retraso (Delay Engine) cada minuto
cron.schedule("* * * * *", () => {
  processScheduledTasks();
  processReminders(); // También procesar recordatorios cada minuto para mayor precisión
});

// Resumen diario 08:00 Europe/Madrid
cron.schedule("0 8 * * *", () => sendDailySummary(), { timezone: "Europe/Madrid" });
