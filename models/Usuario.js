
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
    signatureImageUrl: { type: String, default: null },
    businessEmail: { type: String, default: '' }
  }
});

module.exports = mongoose.model('Usuario', UsuarioSchema);
