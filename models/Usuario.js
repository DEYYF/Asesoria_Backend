
const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
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
    enabledAutomation: { type: Boolean, default: true }
  }
});

module.exports = mongoose.model('Usuario', UsuarioSchema);
