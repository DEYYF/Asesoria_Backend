const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String }, // For client login authentication
  telefono: { type: String, required: true },
  fechaNacimiento: Date,
  edad: Number,
  sexo: { type: String, enum: ['Hombre', 'Mujer', 'Otro'] },
  altura: Number,
  objetivos: [{ type: String, required: true }],
  historialProgreso: [
    {
      fecha: Date,
      peso: Number,
      grasaCorporal: Number,
      MasaMusculoEsqueletica: Number,
      musculo: [{
        nombre: String,
        medida: Number
      }]
    }
  ],
  createdAt: { type: Date, default: Date.now },
  Tarifa: { type: String }, // Nombre de la tarifa (cache)
  Tiempo_Tarifa: { type: String }, // Duración legible (cache)
  tipoServicio: { 
    type: String,
    enum: [
      "Dieta",
      "Dieta y asesoramiento",
      "Rutina",
      "Rutina y asesoramiento",
      "Dieta y Rutina",
      "Mensual",
      "Trimestral",
      "Semestral",
      "Anual"
    ]
  }, // Tipo de servicio de la tarifa activa
  fechaInicio: { type: Date, default: Date.now },
  fechaFin: Date,
  asesorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Referencia al asesor
  consentComms: { type: Boolean, default: false },
  preferContactChannel: { type: String, enum: ["email", "whatsapp"], default: "email" },
  segments: { type: [String], default: [] },
  extras: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Extra' }],
  presupuestoActivo: { type: mongoose.Schema.Types.ObjectId, ref: 'Presupuesto' },
  tarifaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tarifa' },
  
  // Monthly training session counter
  sesionesCounter: { type: Number, default: 0 },
  sesionesLastMonth: { type: String, default: '' }, // Format: "YYYY-MM"

  // Estado manual (Baja = soft delete)
  estado: { type: String, enum: ["Activo", "Baja"], default: "Activo" },


}, { timestamps: true }); // Agregar timestamps automáticos

// Índices para optimizar queries frecuentes
clienteSchema.index({ asesorId: 1, updatedAt: -1 }); // Para /destacados
clienteSchema.index({ asesorId: 1, fechaFin: 1 }); // Para filtrar clientes activos
clienteSchema.index({ email: 1 }); // Para búsquedas por email
clienteSchema.index({ asesorId: 1, segments: 1 }); // Para filtrar por segmentos

module.exports = mongoose.model('Cliente', clienteSchema);
