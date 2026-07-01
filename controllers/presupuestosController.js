const Presupuesto = require("../models/Presuspuesto");
const Tarifa = require("../models/Tarifa");
const Extra = require("../models/Extra");
const Movimiento = require("../models/Movimiento");
const { triggerAutomations } = require("../utils/automationManager");
const { createTarea } = require('../utils/tareas');

exports.crearPresupuesto = async (req, res) => {
  try {
    const { clienteId, nombreCliente, emailCliente, usuarioId, tarifaId, extras = [], fechaInicio, descuento = 0 } = req.body;

    const tarifa = await Tarifa.findById(tarifaId);
    if (!tarifa) return res.status(400).json({ message: "Tarifa inválida" });

    // Calcular número de meses (duracionDias / 30, redondeado)
    const duracionDias = tarifa.duracionDias || 30;
    const meses = Math.ceil(duracionDias / 30);

    // calcular precio total
    let subtotal = tarifa.precio;

    const extrasDetallados = [];
    for (const e of extras) {
      const extra = await Extra.findById(e);
      if (extra) {
        // Multiplicar el precio del extra por el número de meses
        const precioTotal = extra.precio * meses;
        subtotal += precioTotal;
        extrasDetallados.push({ 
          extraId: extra._id, 
          precio: extra.precio, // Precio mensual
          precioTotal // Precio total (mensual × meses)
        });
      }
    }

    // Aplicar descuento (Porcentaje)
    const descuentoValor = (subtotal * descuento) / 100;
    const total = Math.max(0, subtotal - descuentoValor);

    // Calcular fechaFin (usar duracionDias o default 30)
    const fechaFin = new Date(fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + duracionDias);

    const presupuesto = await Presupuesto.create({
      clienteId: clienteId || undefined, // Opcional
      nombreCliente,
      emailCliente,
      usuarioId,
      tarifaId,
      extras: extrasDetallados,
      total,
      descuento, // Guardamos el porcentaje
      fechaInicio,
      fechaFin,
      estado: (clienteId) ? "pendiente" : "borrador", // Si no hay cliente, es borrador por defecto
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Sincronización con Cliente: Si se crea con estado aceptado/pagado, actualizar datos
    // ─────────────────────────────────────────────────────────────────────────────
    const estadoInicial = req.body.estado; // Check if estado was explicitly set in request
    if ((estadoInicial === "aceptado" || estadoInicial === "pagado") && clienteId) {
      const Cliente = require("../models/Cliente");
      
      // Calcular Tiempo_Tarifa aproximado basado en días
      const diffTime = Math.abs(new Date(fechaFin) - new Date(fechaInicio));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      let tiempoTarifa = "1 Mes";
      if (diffDays > 360) tiempoTarifa = "12 Meses";
      else if (diffDays > 170) tiempoTarifa = "6 Meses";
      else if (diffDays > 80) tiempoTarifa = "3 Meses";

      // Extraer IDs de extras
      const extrasIds = extrasDetallados.map(e => e.extraId);

      await Cliente.findByIdAndUpdate(clienteId, {
        Tarifa: tarifa.nombre,
        Tiempo_Tarifa: tiempoTarifa,
        tipoServicio: tarifa.tipoServicio,
        fechaInicio,
        fechaFin,
        extras: extrasIds,
        presupuestoActivo: presupuesto._id,
        tarifaId: tarifa._id,
      });
      
      console.log(`Cliente ${clienteId} actualizado por presupuesto ${presupuesto._id} (creado con ${estadoInicial})`);
      
      // Update presupuesto estado if it was set in request
      if (estadoInicial) {
        presupuesto.estado = estadoInicial;
        await presupuesto.save();
      }
    }

    // AUTOMATION: Create financial movement if PAID
    if (presupuesto.estado === "pagado") {
      await Movimiento.create({
        asesorId: usuarioId,
        descripcion: `Presupuesto Pagado - ${presupuesto.nombreCliente || "Cliente"}`,
        monto: total,
        tipoMovimiento: "INGRESO",
        categoria: "Suscripción",
        clienteId: clienteId || undefined,
        presupuestoId: presupuesto._id,
        Tipo: "FINANZAS"
      });
    }

    // ✅ Crear Tarea Automática: Nueva Planificación (si está pagado)
    if (presupuesto.estado === "pagado" && clienteId) {
      await createTarea(req, {
        assigneeId: usuarioId,
        clientId: clienteId,
        title: `Nueva planificación: ${nombreCliente}`,
        notes: `Presupuesto pagado. Iniciar preparación de dieta y entrenamiento.`,
        priority: 'high',
        tags: [{ label: 'Pago', color: 'green' }],
        origin: 'manual'
      });
    }

    res.status(201).json(presupuesto);
  } catch (err) {
    console.error("Error en crearPresupuesto:", err);
    res.status(500).json({ message: "Error creando presupuesto." });
  }
};

exports.obtenerPresupuestos = async (req, res) => {
  try {
    const { clienteId, asesorId: queryAsesorId } = req.query;
    const isSuperAdmin = req.user?.role === 'superadmin';

    // Enforcement: If not superadmin, must use own ID
    const effectiveAsesorId = isSuperAdmin ? queryAsesorId : req.user.id;

    let filtros = {};
    if (clienteId) filtros.clienteId = clienteId;
    if (effectiveAsesorId) filtros.usuarioId = effectiveAsesorId;

    const presupuestos = await Presupuesto.find(filtros)
      .populate("tarifaId")
      .populate("extras.extraId")
      .populate("clienteId")
      .populate("usuarioId")
      .sort({ createdAt: -1 });

    res.json(presupuestos);
  } catch (err) {
    res.status(500).json({ message: "Error obteniendo presupuestos." });
  }
};

exports.obtenerPresupuesto = async (req, res) => {
  try {
    const presupuesto = await Presupuesto.findById(req.params.id)
      .populate("tarifaId")
      .populate("extras.extraId")
      .populate("clienteId")
      .populate("usuarioId");

    res.json(presupuesto);
  } catch (err) {
    res.status(500).json({ message: "Error obteniendo presupuesto." });
  }
};

exports.actualizarPresupuesto = async (req, res) => {
  try {
    const { descuento, estado } = req.body;
    
    console.log('📝 actualizarPresupuesto called:', {
      presupuestoId: req.params.id,
      descuento,
      estado,
      bodyKeys: Object.keys(req.body)
    });
    
    // Si el estado cambia a "rechazado" y hay un clienteId, eliminar el cliente
    if (estado === "rechazado") {
      const presupuesto = await Presupuesto.findById(req.params.id);
      if (presupuesto && presupuesto.clienteId) {
        const { deleteClienteCascade } = require('../utils/deleteClienteCascade');
        const resultado = await deleteClienteCascade(presupuesto.clienteId);
        
        console.log(`Presupuesto rechazado - Cliente ${presupuesto.clienteId} eliminado:`, resultado);
        
        return res.json({ 
          message: "Presupuesto rechazado y cliente eliminado",
          deleted: resultado
        });
      }
    }
    
    // Si actualizamos estado (con o sin descuento), sincronizar cliente
    if (estado || req.body.clienteId) {
       const updateData = { ...req.body };
       
       const presupuesto = await Presupuesto.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      ).populate('tarifaId').populate('extras.extraId');

      // ─────────────────────────────────────────────────────────────────────────────
      // Sincronización con Cliente: Si se acepta/paga, actualizar datos del cliente
      // ─────────────────────────────────────────────────────────────────────────────
      if ((estado === "aceptado" || estado === "pagado") && presupuesto.clienteId) {
        const Cliente = require("../models/Cliente");
        
        // Calcular Tiempo_Tarifa aproximado basado en días
        const diffTime = Math.abs(new Date(presupuesto.fechaFin) - new Date(presupuesto.fechaInicio));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        let tiempoTarifa = "1 Mes";
        if (diffDays > 360) tiempoTarifa = "12 Meses";
        else if (diffDays > 170) tiempoTarifa = "6 Meses";
        else if (diffDays > 80) tiempoTarifa = "3 Meses";

        // Extraer IDs de extras
        const extrasIds = presupuesto.extras.map(e => e.extraId);

        await Cliente.findByIdAndUpdate(presupuesto.clienteId, {
          Tarifa: presupuesto.tarifaId ? presupuesto.tarifaId.nombre : undefined,
          Tiempo_Tarifa: tiempoTarifa,
          tipoServicio: presupuesto.tarifaId ? presupuesto.tarifaId.tipoServicio : undefined,
          fechaInicio: presupuesto.fechaInicio,
          fechaFin: presupuesto.fechaFin,
          extras: extrasIds,
          presupuestoActivo: presupuesto._id,
          tarifaId: presupuesto.tarifaId ? presupuesto.tarifaId._id : undefined,
        });
        console.log(`Cliente ${presupuesto.clienteId} actualizado por presupuesto ${presupuesto._id} (${estado})`);
      }

      // AUTOMATION: Create financial movement if PAID
      if (estado === "pagado") {
        // Check if movement already exists to avoid duplicates (optional but good)
        const exists = await Movimiento.findOne({ presupuestoId: presupuesto._id, tipoMovimiento: 'INGRESO' });
        if (!exists) {
          await Movimiento.create({
            asesorId: presupuesto.usuarioId,
            descripcion: `Pago Recibido - ${presupuesto.nombreCliente || (presupuesto.clienteId ? "Cliente" : "Externo")}`,
            monto: presupuesto.total,
            tipoMovimiento: "INGRESO",
            categoria: "Suscripción",
            clienteId: presupuesto.clienteId,
            presupuestoId: presupuesto._id,
            Tipo: "FINANZAS"
          });
        }
        
        // Automation Trigger
        await triggerAutomations('BUDGET_PAID', {
          advisorId: presupuesto.usuarioId,
          clientId: presupuesto.clienteId,
          budgetId: presupuesto._id,
          email: presupuesto.emailCliente
        });
      } else if (estado === "rechazado") {
          // Automation Trigger
          await triggerAutomations('BUDGET_REJECTED', {
            advisorId: presupuesto.usuarioId,
            clientId: presupuesto.clienteId,
            budgetId: presupuesto._id,
            email: presupuesto.emailCliente
          });

          // ✅ Crear Tarea Automática: Seguimiento de Rechazo
          await createTarea(req, {
            assigneeId: presupuesto.usuarioId,
            clientId: presupuesto.clienteId,
            title: `Seguimiento Rechazo: ${presupuesto.nombreCliente}`,
            notes: `Presupuesto rechazado. Contactar para entender motivos y ofrecer alternativas.`,
            priority: 'low',
            tags: [{ label: 'Ventas', color: 'red' }],
            origin: 'manual'
          });
      } else if (estado === "aceptado") {
          // AUTO-CREATE INVOICE FROM BUDGET
          if (!presupuesto.facturaId) {
            const Factura = require('../models/Factura');
            const Cliente = require('../models/Cliente');
            const Usuario = require('../models/Usuario');
            const { sendEmail } = require('../utils/notifier');
            
            try {
              // Get asesor and cliente data
              const asesor = await Usuario.findById(presupuesto.usuarioId);
              const cliente = presupuesto.clienteId ? await Cliente.findById(presupuesto.clienteId) : null;
              
              // Generate invoice number
              const numeroFactura = await Factura.generarNumeroFactura();
              
              // Build invoice items from budget (Tariff + Extras)
              let subtotal = 0;
              let totalIVA = 0;
              const invoiceItems = [];
              
              // 1. Tariff Item
              if (presupuesto.tarifaId) {
                const precio = presupuesto.tarifaId.precio;
                const iva = 21;
                const totalItem = precio * (1 + iva / 100);
                
                invoiceItems.push({
                  descripcion: `Servicio: ${presupuesto.tarifaId.nombre}`,
                  cantidad: 1,
                  precioUnitario: precio,
                  iva: iva,
                  descuento: 0,
                  total: totalItem
                });
                
                subtotal += precio;
                totalIVA += (precio * iva / 100);
              }
              
              // 2. Extras Items
              if (presupuesto.extras && presupuesto.extras.length > 0) {
                for (const extraItem of presupuesto.extras) {
                  const extraName = extraItem.extraId ? extraItem.extraId.nombre : 'Servicio Extra';
                  const precio = extraItem.precioTotal;
                  const iva = 21;
                  const totalItem = precio * (1 + iva / 100);

                  invoiceItems.push({
                    descripcion: `Extra: ${extraName}`,
                    cantidad: 1,
                    precioUnitario: precio,
                    iva: iva,
                    descuento: 0,
                    total: totalItem
                  });

                  subtotal += precio;
                  totalIVA += (precio * iva / 100);
                }
              }

              // El descuento del presupuesto se traslada como descuento global de factura.
              // El modelo Factura recalcula siempre: descuento primero y después IVA,
              // evitando cobrar IVA sobre importes descontados.
              const descuentoGlobal = presupuesto.descuento || 0;

              // Validate REQUIRED fields for Factura model
              if (!presupuesto.clienteId) {
                throw new Error("No se puede generar factura: El presupuesto no tiene un cliente vinculado.");
              }

              // Create invoice from budget data
              const factura = await Factura.create({
                numeroFactura,
                serie: 'A',
                asesorId: presupuesto.usuarioId,
                clienteId: presupuesto.clienteId,
                fecha: new Date(),
                vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                concepto: `Presupuesto Aceptado: ${presupuesto.tarifaId?.nombre || 'General'}`,
                items: invoiceItems,
                descuentoGlobal: descuentoGlobal,
                metodoPago: 'transferencia',
                presupuestoId: presupuesto._id,
                datosEmisor: {
                  nombre: asesor?.nombre || 'Asesor',
                  nif: asesor?.nif || 'PENDIENTE',
                  direccion: asesor?.direccion || 'PENDIENTE',
                  codigoPostal: asesor?.codigoPostal || 'PENDIENTE',
                  ciudad: asesor?.ciudad || 'PENDIENTE',
                  provincia: asesor?.provincia,
                  telefono: asesor?.telefono,
                  email: asesor?.email
                },
                datosReceptor: {
                  nombre: cliente?.nombre || presupuesto.nombreCliente || 'Cliente',
                  nif: cliente?.nif || 'PENDIENTE',
                  direccion: cliente?.direccion || 'PENDIENTE',
                  codigoPostal: cliente?.codigoPostal || 'PENDIENTE',
                  ciudad: cliente?.ciudad || 'PENDIENTE',
                  provincia: cliente?.provincia
                },
                creadoPor: presupuesto.usuarioId
              });
              
              // Link invoice to budget
              presupuesto.facturaId = factura._id;
              await presupuesto.save();
              
              console.log(`✓ Factura ${numeroFactura} auto-generada para presupuesto ${presupuesto._id}`);
              
              // Send email notification
              if (cliente && cliente.email) {
                await sendEmail({
                  to: cliente.email,
                  subject: 'Factura Generada - Presupuesto Aceptado',
                  html: `
                    <h2>Presupuesto Aceptado</h2>
                    <p>Hola ${cliente.nombre},</p>
                    <p>Tu presupuesto ha sido aceptado y hemos generado la factura <strong>${numeroFactura}</strong>.</p>
                    <p><strong>Total:</strong> ${factura.total.toFixed(2)}€</p>
                    <p><strong>Vencimiento:</strong> ${new Date(factura.vencimiento).toLocaleDateString('es-ES')}</p>
                    <p>Gracias por tu confianza.</p>
                  `
                });
              }
            } catch (invoiceError) {
              console.error('Error creating invoice from budget:', invoiceError);
              // Don't fail the budget update if invoice creation fails
            }
          }
          
          // Automation Trigger
          await triggerAutomations('BUDGET_ACCEPTED', {
            advisorId: presupuesto.usuarioId,
            clientId: presupuesto.clienteId,
            budgetId: presupuesto._id,
            email: presupuesto.emailCliente
          });

          // ✅ Crear Tarea Automática: Nueva Planificación (al aceptar/pagar)
          await createTarea(req, {
            assigneeId: presupuesto.usuarioId,
            clientId: presupuesto.clienteId,
            title: `Preparar Plan: ${presupuesto.nombreCliente}`,
            notes: `El cliente ha aceptado el presupuesto (${presupuesto.estado}). Empezar con la planificación.`,
            priority: 'high',
            tags: [{ label: 'Planificación', color: 'purple' }],
            origin: 'manual'
          });
      }

      return res.json(presupuesto);
    }

    // Si hay descuento, necesitamos recalcular el total
    if (descuento !== undefined) {
      const presupuesto = await Presupuesto.findById(req.params.id);
      if (!presupuesto) return res.status(404).json({ message: "Presupuesto no encontrado" });

      // Recalcular subtotal desde tarifa + extras (usando precioTotal de cada extra)
      const pFull = await Presupuesto.findById(req.params.id).populate('tarifaId');
      
      // Calcular meses
      const duracionDias = pFull.tarifaId.duracionDias || 30;
      const meses = Math.ceil(duracionDias / 30);
      
      let subtotal = pFull.tarifaId.precio;
      
      // Actualizar extras con precioTotal y sumar al subtotal
      const extrasActualizados = pFull.extras.map(e => {
        const precioMensual = e.precio;
        const precioTotal = precioMensual * meses;
        subtotal += precioTotal;
        return {
          extraId: e.extraId,
          precio: precioMensual,
          precioTotal: precioTotal
        };
      });
      
      console.log(`Recalculando presupuesto ${req.params.id}:`);
      console.log(`- Tarifa: ${pFull.tarifaId.precio}€ (${meses} meses)`);
      console.log(`- Extras:`, extrasActualizados.map(e => `${e.precioTotal}€`));
      console.log(`- Subtotal: ${subtotal}€`);
      console.log(`- Descuento: ${descuento}%`);
      
      // Nuevo total con nuevo descuento (%)
      const descuentoValor = (subtotal * descuento) / 100;
      const nuevoTotal = Math.max(0, subtotal - descuentoValor);
      
      console.log(`- Descuento valor: ${descuentoValor}€`);
      console.log(`- Nuevo total: ${nuevoTotal}€`);
      
      presupuesto.extras = extrasActualizados;
      presupuesto.descuento = descuento;
      presupuesto.total = nuevoTotal;
      if (estado) presupuesto.estado = estado;
      
      await presupuesto.save();
      return res.json(presupuesto);
    }

    // Fallback normal
    const presupuesto = await Presupuesto.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(presupuesto);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error actualizando presupuesto." });
  }
};

// Actualizar extras de un presupuesto y recalcular total
exports.actualizarExtrasPresupuesto = async (req, res) => {
  try {
    const { extras } = req.body; // Array de IDs de extras
    
    const presupuesto = await Presupuesto.findById(req.params.id).populate('tarifaId');
    if (!presupuesto) return res.status(404).json({ message: "Presupuesto no encontrado" });

    const Extra = require("../models/Extra");
    
    // Calcular meses
    const duracionDias = presupuesto.tarifaId.duracionDias || 30;
    const meses = Math.ceil(duracionDias / 30);
    
    // Calcular subtotal: tarifa + extras
    let subtotal = presupuesto.tarifaId.precio * meses;
    const extrasDetallados = [];
    
    for (const extraId of extras) {
      const extra = await Extra.findById(extraId);
      if (extra) {
        const precioTotal = extra.precio * meses;
        subtotal += precioTotal;
        extrasDetallados.push({ 
          extraId: extra._id, 
          precio: extra.precio,
          precioTotal
        });
      }
    }
    
    // Aplicar descuento existente
    const descuentoValor = (subtotal * presupuesto.descuento) / 100;
    const nuevoTotal = Math.max(0, subtotal - descuentoValor);
    
    console.log(`Actualizando extras del presupuesto ${req.params.id}:`);
    console.log(`- Tarifa: ${presupuesto.tarifaId.precio}€ × ${meses} meses`);
    console.log(`- Extras:`, extrasDetallados.map(e => `${e.precioTotal}€`));
    console.log(`- Subtotal: ${subtotal}€`);
    console.log(`- Descuento: ${presupuesto.descuento}%`);
    console.log(`- Nuevo total: ${nuevoTotal}€`);
    
    presupuesto.extras = extrasDetallados;
    presupuesto.total = nuevoTotal;
    
    await presupuesto.save();
    
    // Si el presupuesto está aceptado/pagado, actualizar también el cliente
    if (presupuesto.estado === "aceptado" || presupuesto.estado === "pagado") {
      if (presupuesto.clienteId) {
        const Cliente = require("../models/Cliente");
        const extrasIds = extrasDetallados.map(e => e.extraId);
        await Cliente.findByIdAndUpdate(presupuesto.clienteId, {
          extras: extrasIds,
        });
        console.log(`Cliente ${presupuesto.clienteId} actualizado con nuevos extras`);
      }
    }
    
    res.json(presupuesto);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error actualizando extras del presupuesto." });
  }
};

exports.eliminarPresupuesto = async (req, res) => {
  try {
    const presupuesto = await Presupuesto.findByIdAndDelete(req.params.id);
    if (!presupuesto) {
      return res.status(404).json({ message: "Presupuesto no encontrado" });
    }
    res.json({ message: "Presupuesto eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error eliminando presupuesto." });
  }
};
