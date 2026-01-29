const mongoose = require('mongoose');

const FacturaSchema = new mongoose.Schema({
  // Número de factura secuencial por año (ej: 2024-001, 2024-002)
  numeroFactura: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Serie de factura (opcional, para separar tipos de facturas)
  serie: {
    type: String,
    default: 'A'
  },

  // Referencias
  asesorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente',
    required: true,
    index: true
  },

  // Fechas
  fecha: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  vencimiento: {
    type: Date,
    required: true
  },

  // Concepto general
  concepto: {
    type: String,
    required: true
  },

  // Líneas de factura
  items: [{
    descripcion: {
      type: String,
      required: true
    },
    cantidad: {
      type: Number,
      required: true,
      default: 1
    },
    precioUnitario: {
      type: Number,
      required: true
    },
    // IVA en España: 21% general, 10% reducido, 4% superreducido
    iva: {
      type: Number,
      required: true,
      default: 21
    },
    descuento: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    }
  }],

  // Totales
  subtotal: {
    type: Number,
    required: true
  },
  
  totalIVA: {
    type: Number,
    required: true
  },
  
  descuentoGlobal: {
    type: Number,
    default: 0
  },
  
  total: {
    type: Number,
    required: true
  },

  // Estado de la factura
  estado: {
    type: String,
    enum: ['pendiente', 'pagada', 'vencida', 'cancelada'],
    default: 'pendiente',
    index: true
  },

  // Método de pago
  metodoPago: {
    type: String,
    enum: ['efectivo', 'transferencia', 'tarjeta', 'bizum', 'otro'],
    default: 'transferencia'
  },

  // Fecha de pago (si está pagada)
  fechaPago: {
    type: Date
  },

  // Notas adicionales
  notas: {
    type: String
  },

  // URL del PDF generado
  pdfUrl: {
    type: String
  },

  // DATOS LEGALES EMISOR (Asesor/Empresa)
  datosEmisor: {
    nombre: {
      type: String,
      required: true
    },
    // NIF/CIF obligatorio en España
    nif: {
      type: String,
      required: true
    },
    direccion: {
      type: String,
      required: true
    },
    codigoPostal: {
      type: String,
      required: true
    },
    ciudad: {
      type: String,
      required: true
    },
    provincia: {
      type: String
    },
    telefono: {
      type: String
    },
    email: {
      type: String,
      required: true
    }
  },

  // DATOS LEGALES RECEPTOR (Cliente)
  datosReceptor: {
    nombre: {
      type: String,
      required: true
    },
    // NIF/NIE del cliente
    nif: {
      type: String,
      required: true
    },
    direccion: {
      type: String,
      required: true
    },
    codigoPostal: {
      type: String,
      required: true
    },
    ciudad: {
      type: String,
      required: true
    },
    provincia: {
      type: String
    }
  },

  // Metadatos
  presupuestoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Presupuesto',
  },
  
  creadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  
  modificadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  }

}, { 
  timestamps: true 
});

// Índices compuestos para búsquedas eficientes
FacturaSchema.index({ asesorId: 1, fecha: -1 });
FacturaSchema.index({ clienteId: 1, fecha: -1 });
FacturaSchema.index({ estado: 1, vencimiento: 1 });

// Método para calcular totales automáticamente
FacturaSchema.methods.calcularTotales = function() {
  let subtotal = 0;
  let totalIVA = 0;

  this.items.forEach(item => {
    const baseItem = item.cantidad * item.precioUnitario;
    const descuentoItem = baseItem * (item.descuento / 100);
    const baseConDescuento = baseItem - descuentoItem;
    const ivaItem = baseConDescuento * (item.iva / 100);
    
    item.total = baseConDescuento + ivaItem;
    subtotal += baseConDescuento;
    totalIVA += ivaItem;
  });

  this.subtotal = subtotal;
  this.totalIVA = totalIVA;
  
  const descuentoGlobalImporte = subtotal * (this.descuentoGlobal / 100);
  this.total = subtotal + totalIVA - descuentoGlobalImporte;
};

// Middleware para calcular totales antes de guardar
FacturaSchema.pre('save', function(next) {
  if (this.isModified('items') || this.isModified('descuentoGlobal')) {
    this.calcularTotales();
  }
  next();
});

// Método estático para generar número de factura
FacturaSchema.statics.generarNumeroFactura = async function(serie = 'A') {
  const year = new Date().getFullYear();
  
  // Buscar la última factura del año y serie
  const ultimaFactura = await this.findOne({
    serie,
    numeroFactura: new RegExp(`^${serie}-${year}-`)
  }).sort({ numeroFactura: -1 });

  let numero = 1;
  if (ultimaFactura) {
    const partes = ultimaFactura.numeroFactura.split('-');
    numero = parseInt(partes[2]) + 1;
  }

  // Formato: A-2024-001
  return `${serie}-${year}-${numero.toString().padStart(3, '0')}`;
};

module.exports = mongoose.model('Factura', FacturaSchema);
