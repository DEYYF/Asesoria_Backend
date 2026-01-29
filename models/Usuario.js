
const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['advisor', 'superadmin'], default: 'advisor' },
  // Datos para facturación
  nif: { type: String },
  direccion: { type: String },
  codigoPostal: { type: String },
  ciudad: { type: String },
  provincia: { type: String },
  telefono: { type: String },
  createdAt: { type: Date, default: Date.now },
  calendarSettings: {
    bloques: [{
      weekday: { type: Number, min: 0, max: 6 },
      start: String,  // "HH:mm"
      end: String     // "HH:mm"
    }],
    workHours: {
      startHour: { type: Number, default: 7 },
      endHour: { type: Number, default: 22 }
    },
    vacationDays: [String]  // Array of ISO dates: ["2024-12-25", "2024-12-26"]
  },
  settings: {
    pushNotifications: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    theme: { type: String, default: 'system' },
    accentColor: { type: String, default: '#007AFF' },
    emailSignature: { type: String, default: '' },
    signatureImageUrl: { type: String, default: '' },
    businessEmail: { type: String, default: '' },
    weightFrequency: { type: String, default: 'weekly' },
    fatFrequency: { type: String, default: 'weekly' },
    measuresFrequency: { type: String, default: 'monthly' },
    muscleFrequency: { type: String, default: 'monthly' },
    enabledChat: { type: Boolean, default: true },
    enabledEmail: { type: Boolean, default: true },
    enabledProgressFrequencies: { type: Boolean, default: true },
    enabledTemplateManagement: { type: Boolean, default: true },
    enabledTrainingLog: { type: Boolean, default: true },
    enabledFoodScanner: { type: Boolean, default: true },
    enabledAutomation: { type: Boolean, default: true },
    enabledFinanzas: { type: Boolean, default: true },
    pdfSettings: {
      primaryColor: { type: String, default: '#007AFF' },
      secondaryColor: { type: String, default: '#34C759' },
      accentColor: { type: String, default: '#FFD700' },
      logoUrl: { type: String, default: '' },
      headerTitle: { type: String, default: 'Asesoría Pro' },
      footerText: { type: String, default: 'Gracias por confiar en nuestros servicios.' },
      footerContactInfo: { type: String, default: '' },
      fontFamily: { type: String, default: 'Helvetica' },
      includeCoverPage: { type: Boolean, default: false },
      headerStyle: { type: String, default: 'classic' }, // 'classic', 'modern', 'minimal', 'side'
      showMacrosSummary: { type: Boolean, default: true },
      
      // Layout & Spacing
      pageMargins: { type: String, default: 'medium' }, // 'small', 'medium', 'large'
      lineSpacing: { type: Number, default: 1.2 },
      sectionSpacing: { type: Number, default: 20 },
      
      // Typography
      headerFontSize: { type: Number, default: 18 },
      bodyFontSize: { type: Number, default: 10 },
      tableFontSize: { type: Number, default: 9 },
      
      // Table Styling
      tableBorderStyle: { type: String, default: 'light' }, // 'none', 'light', 'medium', 'bold'
      alternateRowColors: { type: Boolean, default: false },
      tableHeaderColor: { type: String, default: '' }, // empty = use primaryColor
      
      // Branding
      watermarkText: { type: String, default: '' },
      watermarkOpacity: { type: Number, default: 0.1 },
      logoSize: { type: String, default: 'medium' }, // 'small', 'medium', 'large'
      logoPosition: { type: String, default: 'header' }, // 'header', 'footer', 'cover'
      
      // Advanced
      pageOrientation: { type: String, default: 'auto' }, // 'auto', 'portrait', 'landscape'
      showPageNumbers: { type: Boolean, default: true },
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
      currencySymbol: { type: String, default: '€' }
    },
    emailTemplates: {
      citaCreated: {
        subject: { type: String, default: 'Nueva Cita Agendada' },
        body: { type: String, default: 'Hola {{clienteNombre}},\n\nSe ha agendado una nueva cita:\n\nTítulo: {{titulo}}\nFecha: {{fecha}}\nHora: {{hora}}\n\nSaludos,\n{{asesorNombre}}' },
        enabled: { type: Boolean, default: true }
      },
      citaUpdated: {
        subject: { type: String, default: 'Cita Modificada' },
        body: { type: String, default: 'Hola {{clienteNombre}},\n\nTu cita ha sido modificada:\n\nTítulo: {{titulo}}\nNueva Fecha: {{fecha}}\nNueva Hora: {{hora}}\n\nSaludos,\n{{asesorNombre}}' },
        enabled: { type: Boolean, default: true }
      },
      citaReminder: {
        subject: { type: String, default: 'Recordatorio de Cita' },
        body: { type: String, default: 'Hola {{clienteNombre}},\n\nRecuerda que tienes una cita programada:\n\nTítulo: {{titulo}}\nFecha: {{fecha}}\nHora: {{hora}}\n\nTe esperamos.' },
        enabled: { type: Boolean, default: true }
      }
    },
    kanbanColumns: {
      type: [{
        id: String,
        title: String,
        color: String,
        order: Number
      }],
      default: [
        { id: 'todo', title: 'PENDIENTE', color: 'orange', order: 0 },
        { id: 'doing', title: 'EN PROGRESO', color: 'blue', order: 1 },
        { id: 'done', title: 'COMPLETADO', color: 'green', order: 2 }
      ]
    },
    intelligence: {
      advancedAnalysis: { type: Boolean, default: false }, // Use body comp data
      stallThreshold: { type: Number, default: 0.2 },
      rapidGainThreshold: { type: Number, default: 0.5 },
      rapidLossThreshold: { type: Number, default: 1.0 }, // New: Limit for rapid loss
      steps: {
        enabled: { type: Boolean, default: true },
        increment: { type: Number, default: 2000 }, // +2000 steps
        prioritize: { type: Boolean, default: true } // Suggest steps before diet
      },
      macroAdjustment: {
        loss: {
          kcal: { type: Number, default: 0.9 }, // 0.9 = -10%
          carbs: { type: Number, default: 0.85 } // 0.85 = -15%
        },
        gain: {
          kcal: { type: Number, default: 1.05 }, // 1.05 = +5%
          carbs: { type: Number, default: 1.1 } // 1.1 = +10%
        },
        rapidGain: {
          kcal: { type: Number, default: 0.95 }, // 0.95 = -5% (reduce surplus)
          carbs: { type: Number, default: 0.9 } // 0.9 = -10%
        },
        rapidLoss: {
          kcal: { type: Number, default: 1.05 }, // 1.05 = +5% (increase to stop muscle loss)
          carbs: { type: Number, default: 1.1 } // 1.1 = +10%
        }
      },
      trainingIncrements: {
        large: { type: Number, default: 5.0 },
        medium: { type: Number, default: 2.5 },
        small: { type: Number, default: 1.25 }
      }
    }
  },
  googleCalendar: {
    accessToken: String,
    refreshToken: String,
    expiryDate: Number,
    email: String,
    isEnabled: { type: Boolean, default: false }
  }
});

module.exports = mongoose.model('Usuario', UsuarioSchema);
