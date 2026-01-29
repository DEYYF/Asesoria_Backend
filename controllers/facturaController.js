const Factura = require('../models/Factura');
const Cliente = require('../models/Cliente');
const Usuario = require('../models/Usuario');
const { generateInvoicePDF } = require('../utils/pdfGenerator');
const { sendEmail } = require('../utils/notifier');

// Crear nueva factura
exports.createFactura = async (req, res) => {
  try {
    const {
      clienteId,
      concepto,
      items,
      vencimiento,
      metodoPago,
      notas,
      serie,
      descuentoGlobal
    } = req.body;

    const asesorId = req.user.id;

    // Obtener datos del asesor
    const asesor = await Usuario.findById(asesorId);
    if (!asesor) {
      return res.status(404).json({ error: 'Asesor no encontrado' });
    }

    // Obtener datos del cliente
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Verificar que el cliente pertenece al asesor
    if (cliente.asesorId.toString() !== asesorId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Generar número de factura
    const numeroFactura = await Factura.generarNumeroFactura(serie || 'A');

    // Crear factura
    const factura = new Factura({
      numeroFactura,
      serie: serie || 'A',
      asesorId,
      clienteId,
      fecha: new Date(),
      vencimiento: vencimiento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días por defecto
      concepto,
      items,
      metodoPago: metodoPago || 'transferencia',
      notas,
      descuentoGlobal: descuentoGlobal || 0,
      datosEmisor: {
        nombre: asesor.nombre || asesor.email,
        nif: asesor.nif || 'PENDIENTE',
        direccion: asesor.direccion || 'PENDIENTE',
        codigoPostal: asesor.codigoPostal || 'PENDIENTE',
        ciudad: asesor.ciudad || 'PENDIENTE',
        provincia: asesor.provincia,
        telefono: asesor.telefono,
        email: asesor.email
      },
      datosReceptor: {
        nombre: cliente.nombre,
        nif: cliente.nif || 'PENDIENTE',
        direccion: cliente.direccion || 'PENDIENTE',
        codigoPostal: cliente.codigoPostal || 'PENDIENTE',
        ciudad: cliente.ciudad || 'PENDIENTE',
        provincia: cliente.provincia
      },
      creadoPor: asesorId
    });

    await factura.save();

    res.status(201).json(factura);
  } catch (error) {
    console.error('Error creating factura:', error);
    res.status(500).json({ error: error.message });
  }
};

// Obtener todas las facturas (con filtros)
exports.getFacturas = async (req, res) => {
  try {
    const userId = req.user.id;
    const { clienteId, estado, desde, hasta, limit = 50, skip = 0 } = req.query;

    const query = { asesorId: userId };

    if (clienteId) query.clienteId = clienteId;
    if (estado) query.estado = estado;
    if (desde || hasta) {
      query.fecha = {};
      if (desde) query.fecha.$gte = new Date(desde);
      if (hasta) query.fecha.$lte = new Date(hasta);
    }

    const facturas = await Factura.find(query)
      .populate('clienteId', 'nombre email')
      .sort({ fecha: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Factura.countDocuments(query);

    res.json({
      facturas,
      total,
      hasMore: total > parseInt(skip) + facturas.length
    });
  } catch (error) {
    console.error('Error getting facturas:', error);
    res.status(500).json({ error: error.message });
  }
};

// Obtener factura por ID
exports.getFacturaById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const factura = await Factura.findById(id)
      .populate('clienteId', 'nombre email')
      .populate('asesorId', 'nombre email');

    if (!factura) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    // Verificar autorización
    if (factura.asesorId._id.toString() !== userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    res.json(factura);
  } catch (error) {
    console.error('Error getting factura:', error);
    res.status(500).json({ error: error.message });
  }
};

// Actualizar estado de factura
exports.updateFacturaEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, fechaPago, metodoPago } = req.body;
    const userId = req.user.id;

    const factura = await Factura.findById(id);
    if (!factura) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    if (factura.asesorId.toString() !== userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    factura.estado = estado;
    if (estado === 'pagada' && fechaPago) {
      factura.fechaPago = fechaPago;
    }
    if (metodoPago) {
      factura.metodoPago = metodoPago;
    }
    factura.modificadoPor = userId;

    await factura.save();

    // AUTO-UPDATE BUDGET STATUS TO "PAGADO" IF INVOICE IS PAID
    if (estado === 'pagada' && factura.presupuestoId) {
      const Presupuesto = require('../models/Presuspuesto');
      try {
        const presupuesto = await Presupuesto.findById(factura.presupuestoId);
        if (presupuesto && presupuesto.estado !== 'pagado') {
          presupuesto.estado = 'pagado';
          await presupuesto.save();
          console.log(`✓ Presupuesto ${presupuesto._id} actualizado a "pagado" por factura ${factura.numeroFactura}`);
        }
      } catch (budgetError) {
        console.error('Error updating budget status:', budgetError);
        // Don't fail invoice update if budget update fails
      }
    }

    res.json(factura);
  } catch (error) {
    console.error('Error updating factura:', error);
    res.status(500).json({ error: error.message });
  }
};

// Generar PDF de factura
exports.generateFacturaPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const factura = await Factura.findById(id)
      .populate('clienteId')
      .populate('asesorId');

    if (!factura) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    if (factura.asesorId._id.toString() !== userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const pdfBuffer = await generateInvoicePDF(factura);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Factura-${factura.numeroFactura}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: error.message });
  }
};

// Enviar factura por email
exports.sendFacturaEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const factura = await Factura.findById(id)
      .populate('clienteId')
      .populate('asesorId');

    if (!factura) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    if (factura.asesorId._id.toString() !== userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Generar PDF
    const pdfBuffer = await generateInvoicePDF(factura);

    // Enviar email
    await sendEmail({
      to: factura.clienteId.email,
      subject: `Factura ${factura.numeroFactura} - ${factura.concepto}`,
      html: `
        <h2>Nueva Factura</h2>
        <p>Hola ${factura.datosReceptor.nombre},</p>
        <p>Adjunto encontrarás la factura <strong>${factura.numeroFactura}</strong>.</p>
        <p><strong>Concepto:</strong> ${factura.concepto}</p>
        <p><strong>Total:</strong> ${factura.total.toFixed(2)}€</p>
        <p><strong>Vencimiento:</strong> ${new Date(factura.vencimiento).toLocaleDateString('es-ES')}</p>
        ${factura.notas ? `<p><strong>Notas:</strong> ${factura.notas}</p>` : ''}
        <p>Gracias por tu confianza.</p>
      `,
      attachments: [{
        filename: `Factura-${factura.numeroFactura}.pdf`,
        content: pdfBuffer
      }]
    });

    res.json({ success: true, message: 'Factura enviada por email' });
  } catch (error) {
    console.error('Error sending factura email:', error);
    res.status(500).json({ error: error.message });
  }
};

// Eliminar factura (solo si está en borrador/cancelada)
exports.deleteFactura = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const factura = await Factura.findById(id);
    if (!factura) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    if (factura.asesorId.toString() !== userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Solo permitir eliminar facturas canceladas o pendientes
    if (factura.estado === 'pagada') {
      return res.status(400).json({ error: 'No se puede eliminar una factura pagada' });
    }

    await Factura.findByIdAndDelete(id);

    res.json({ success: true, message: 'Factura eliminada' });
  } catch (error) {
    console.error('Error deleting factura:', error);
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de facturación
exports.getFacturasStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { year } = req.query;
    const currentYear = year || new Date().getFullYear();

    const stats = await Factura.aggregate([
      {
        $match: {
          asesorId: new require('mongoose').Types.ObjectId(userId),
          fecha: {
            $gte: new Date(`${currentYear}-01-01`),
            $lte: new Date(`${currentYear}-12-31`)
          }
        }
      },
      {
        $group: {
          _id: '$estado',
          count: { $sum: 1 },
          total: { $sum: '$total' }
        }
      }
    ]);

    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
};
