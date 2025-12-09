const Presupuesto = require("../models/Presuspuesto");
const Tarifa = require("../models/Tarifa");
const Extra = require("../models/Extra");

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

    res.status(201).json(presupuesto);
  } catch (err) {
    console.error("Error en crearPresupuesto:", err);
    res.status(500).json({ message: "Error creando presupuesto." });
  }
};

exports.obtenerPresupuestos = async (req, res) => {
  try {
    const { clienteId, asesorId } = req.query;
    let filtros = {};

    if (clienteId) filtros.clienteId = clienteId;
    if (asesorId) filtros.usuarioId = asesorId;

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
    if (estado) {
       const presupuesto = await Presupuesto.findByIdAndUpdate(
        req.params.id,
        { estado },
        { new: true }
      ).populate('tarifaId');

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
