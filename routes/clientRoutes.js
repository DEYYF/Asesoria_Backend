const express = require("express");
const Cliente = require("../models/Cliente");
const Dieta = require("../models/Dieta");
const Entrenamiento = require("../models/Entrenamiento");
const Cita = require("../models/Cita");
const { Types } = require("mongoose");
const router = express.Router();
const { logMovimiento } = require('../utils/logMovimiento');
const { z } = require("zod");
const Presupuesto = require("../models/Presuspuesto");
const Tarifa = require("../models/Tarifa");

// ────────────────────────────── Obtener estado del presupuesto de un cliente
router.get("/:id/budget-status", async (req, res) => {
  try {
    const presupuesto = await Presupuesto.findOne({ clienteId: req.params.id })
      .sort({ createdAt: -1 }); // Obtener el más reciente
    
    if (!presupuesto) {
      return res.json({ 
        hasPresupuesto: false, 
        estado: null,
        canEdit: false,
        message: "El cliente no tiene presupuesto"
      });
    }

    const canEdit = presupuesto.estado === "aceptado" || presupuesto.estado === "pagado";

    res.json({
      hasPresupuesto: true,
      estado: presupuesto.estado,
      canEdit,
      message: canEdit 
        ? "Acceso completo" 
        : `Presupuesto ${presupuesto.estado}. ${presupuesto.estado === "pendiente" ? "Esperando aceptación." : "Acceso denegado."}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────── Crear
router.post("/", async (req, res) => {
  try {
    const cliente = await Cliente.create(req.body);
    res.json(cliente);
    // Log (no bloquea)
    req.body.asesorId = req.body.asesorId || cliente.asesorId;
    req.body.tipo = "CREAR";
    await logMovimiento(req, `Cliente creado: ${cliente.nombre}`);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ────────────────────────────── Listado simple
router.get("/", async (req, res) => {
  const clientes = await Cliente.find().lean(); // .lean() para mejor performance
  res.json(clientes);
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  DESTACADOS  (PONEMOS ESTA RUTA ANTES DE CUALQUIER "/:id")
 *  GET /clientes/destacados?asesorId=&limit=&cutoffDays=
 *  - Enriquecer: tieneDieta / tieneEntrenamiento
 *  - proximaCita real (primera >= hoy)
 *  - buckets: atencion / seguimiento / sinProxima
 *  - meta: pendientesHoy (citas de hoy con hora >= ahora o sin hora)
 * ─────────────────────────────────────────────────────────────────────────────
 */

router.get("/destacados", async (req, res) => {
  try {
    const { asesorId, limit = 200, cutoffDays = 3, segments } = req.query;

    const asesorMatch = asesorId
      ? { asesorId: Types.ObjectId.isValid(String(asesorId)) ? new Types.ObjectId(String(asesorId)) : String(asesorId) }
      : {};

    let segList = null;
    if (segments) segList = String(segments).split(",").map(s => s.trim()).filter(Boolean);

    const baseMatch = { ...asesorMatch, ...(segList ? { segments: { $in: segList } } : {}) };

    const clientes = await Cliente.find(baseMatch, {
      nombre: 1, email: 1, telefono: 1, Tarifa: 1, fechaFin: 1, asesorId: 1, avatarUrl: 1, segments: 1,
    })
      .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
      .limit(parseInt(limit, 10))
      .lean();

    const ids = clientes.map((c) => c._id);

    const [dietas, entrenamientos] = await Promise.all([
      Dieta.find({ clienteId: { $in: ids } }, { clienteId: 1 }).lean(),
      Entrenamiento.find({ clienteId: { $in: ids } }, { clienteId: 1 }).lean(),
    ]);

    const hasDieta = new Set(dietas.map((d) => String(d.clienteId)));
    const hasEntr  = new Set(entrenamientos.map((e) => String(e.clienteId)));

    const todayISO = () => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
    };
    const daysDiff = (aISO, bISO = todayISO()) => {
      if (!aISO) return null;
      return Math.floor((new Date(aISO) - new Date(bISO)) / 86400000);
    };
    const hoy = todayISO();

    const citas = await Cita.find({ clienteId: { $in: ids }, date: { $gte: hoy } })
      .sort({ date: 1, hora: 1 })
      .lean();

    const now = new Date();
    const nowHM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const pendientesHoy = citas.filter((c) => c.date === hoy && (!c.hora || c.hora >= nowHM)).length;

    const mapCita = new Map();
    for (const c of citas) {
      const key = String(c.clienteId);
      if (!mapCita.has(key)) mapCita.set(key, c);
    }

    const cut = parseInt(cutoffDays, 10) || 3;
    const atencion = [];
    const seguimiento = [];
    const sinProxima = [];

    const items = clientes.map((c) => {
      const id = String(c._id);
      const tieneDieta = hasDieta.has(id);
      const tieneEntrenamiento = hasEntr.has(id);

      let estado = "Activo";
      const venceEn = c.fechaFin != null ? daysDiff(c.fechaFin) : null;
      if (c.fechaFin && venceEn < 0) estado = "Inactivo";
      else if (c.Tarifa && !tieneDieta && !tieneEntrenamiento) estado = "En seguimiento";

      const cita = mapCita.get(id);
      const proximaCita = cita ? { id: cita._id, title: cita.title, date: cita.date, hora: cita.hora, horaFin: cita.horaFin } : null;

      const enriched = { ...c, tieneDieta, tieneEntrenamiento, estado, venceEn, proximaCita };

      if (estado === "Inactivo" || (venceEn !== null && venceEn >= 0 && venceEn <= cut)) atencion.push(enriched);
      if (estado === "En seguimiento") seguimiento.push(enriched);
      if (!proximaCita) sinProxima.push(enriched);

      return enriched;
    });

    const smartSort = (a, b) => {
      const aNoNext = !a.proximaCita ? 0 : 1;
      const bNoNext = !b.proximaCita ? 0 : 1;
      if (aNoNext !== bNoNext) return aNoNext - bNoNext;
      const av = a.venceEn ?? 999, bv = b.venceEn ?? 999;
      if (av !== bv) return av - bv;
      return (a.nombre || "").localeCompare(b.nombre || "");
    };

    atencion.sort(smartSort);
    seguimiento.sort(smartSort);
    sinProxima.sort(smartSort);

    return res.json({
      items,
      buckets: { atencion, seguimiento, sinProxima },
      meta: {
        total: items.length,
        conProximaCita: items.filter((x) => x.proximaCita).length,
        pendientesHoy,
        cutoffDays: cut,
      },
    });
  } catch (err) {
    console.error("GET /clientes/destacados", err);
    res.status(500).json({ error: err.message || "Error generando destacados" });
  }
});


// ────────────────────────────── Historial de progreso
router.get("/:id/historial", async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const cliente = await Cliente.findById(id);
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(cliente.historialProgreso);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ────────────────────────────── Actualizar tiempo de tarifa (Renovar) -> Crea Presupuesto
router.put("/:id/actualizar-tarifa", async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: "ID inválido" });
    }
    
    const cliente = await Cliente.findById(id);
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

    // Obtener el último presupuesto del cliente para copiar tarifa y extras
    const ultimoPresupuesto = await Presupuesto.findOne({ clienteId: id })
      .sort({ createdAt: -1 })
      .populate('tarifaId')
      .lean();

    if (!ultimoPresupuesto || !ultimoPresupuesto.tarifaId) {
      return res.status(400).json({ error: "No se encontró un presupuesto previo para renovar" });
    }

    const tarifaDoc = ultimoPresupuesto.tarifaId;
    
    // Calcular meses basado en duracionDias de la tarifa
    const duracionDias = tarifaDoc.duracionDias || 30;
    const meses = Math.ceil(duracionDias / 30);
    
    const fechaInicio = new Date();
    const fechaFin = new Date(fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + duracionDias);

    // Copiar extras del presupuesto anterior
    let extrasDetallados = [];
    let subtotal = tarifaDoc.precio * meses;

    if (ultimoPresupuesto.extras && ultimoPresupuesto.extras.length > 0) {
      const Extra = require("../models/Extra");
      
      for (const extraItem of ultimoPresupuesto.extras) {
        const extraId = extraItem.extraId;
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
    }

    // Crear Presupuesto Pendiente con la misma tarifa y extras
    const presupuesto = await Presupuesto.create({
      clienteId: cliente._id,
      nombreCliente: cliente.nombre,
      emailCliente: cliente.email,
      usuarioId: cliente.asesorId,
      tarifaId: tarifaDoc._id,
      extras: extrasDetallados,
      total: subtotal,
      descuento: 0,
      fechaInicio,
      fechaFin,
      estado: "pendiente",
    });

    req.body.asesorId = req.body.asesorId || cliente.asesorId;
    req.body.tipo = "EDITAR";
    await logMovimiento(req, `Solicitud renovación (Presupuesto creado): ${cliente.nombre}`);

    res.json({ message: "Presupuesto creado", presupuesto });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ────────────────────────────── Cambiar tarifa -> Crea Presupuesto
router.put("/:id/tarifa", async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const { Tarifa: nombreTarifa } = req.body;
    
    const cliente = await Cliente.findById(id);
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

    // Buscar la nueva tarifa
    const tarifaDoc = await Tarifa.findOne({ nombre: nombreTarifa });
    if (!tarifaDoc) {
      return res.status(400).json({ error: `No se encontró la tarifa: ${nombreTarifa}` });
    }

    // Calcular meses basado en duracionDias de la tarifa
    const duracionDias = tarifaDoc.duracionDias || 30;
    const meses = Math.ceil(duracionDias / 30);
    
    const fechaInicio = new Date();
    const fechaFin = new Date(fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + duracionDias);

    // Obtener el último presupuesto del cliente para copiar los extras
    const ultimoPresupuesto = await Presupuesto.findOne({ clienteId: id })
      .sort({ createdAt: -1 })
      .lean();

    let extrasDetallados = [];
    let subtotal = tarifaDoc.precio * meses;

    // Si hay un presupuesto anterior, copiar sus extras
    if (ultimoPresupuesto && ultimoPresupuesto.extras && ultimoPresupuesto.extras.length > 0) {
      const Extra = require("../models/Extra");
      
      for (const extraItem of ultimoPresupuesto.extras) {
        const extraId = extraItem.extraId;
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
    }

    // Crear Presupuesto Pendiente con los extras copiados
    const presupuesto = await Presupuesto.create({
      clienteId: cliente._id,
      nombreCliente: cliente.nombre,
      emailCliente: cliente.email,
      usuarioId: cliente.asesorId,
      tarifaId: tarifaDoc._id,
      extras: extrasDetallados,
      total: subtotal,
      descuento: 0,
      fechaInicio,
      fechaFin,
      estado: "pendiente",
    });

    req.body.asesorId = req.body.asesorId || cliente.asesorId;
    req.body.tipo = "EDITAR";
    await logMovimiento(req, `Solicitud cambio tarifa (Presupuesto creado): ${cliente.nombre}`);

    res.json({ message: "Presupuesto creado", presupuesto });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ────────────────────────────── Gestionar Extras -> Crea Presupuesto
router.put("/:id/extras", async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const { extras } = req.body; // Array de IDs de extras
    
    const cliente = await Cliente.findById(id);
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

    // Buscar la tarifa actual del cliente
    const tarifaDoc = await Tarifa.findOne({ nombre: cliente.Tarifa });
    if (!tarifaDoc) {
      return res.status(400).json({ error: `No se encontró la tarifa: ${cliente.Tarifa}` });
    }

    // Calcular meses basado en el tiempo actual
    const meses = cliente.Tiempo_Tarifa === "1 Mes" ? 1 : cliente.Tiempo_Tarifa === "3 Meses" ? 3 : cliente.Tiempo_Tarifa === "6 Meses" ? 6 : 12;
    
    const fechaInicio = new Date();
    const fechaFin = new Date();
    fechaFin.setMonth(fechaFin.getMonth() + meses);

    // Calcular total con extras
    const Extra = require("../models/Extra");
    let subtotal = tarifaDoc.precio * meses;
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

    // Crear Presupuesto Pendiente
    const presupuesto = await Presupuesto.create({
      clienteId: cliente._id,
      nombreCliente: cliente.nombre,
      emailCliente: cliente.email,
      usuarioId: cliente.asesorId,
      tarifaId: tarifaDoc._id,
      extras: extrasDetallados,
      total: subtotal,
      descuento: 0,
      fechaInicio,
      fechaFin,
      estado: "pendiente",
    });

    req.body.asesorId = req.body.asesorId || cliente.asesorId;
    req.body.tipo = "EDITAR";
    await logMovimiento(req, `Solicitud gestión extras (Presupuesto creado): ${cliente.nombre}`);

    res.json({ message: "Presupuesto creado", presupuesto });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ────────────────────────────── Renovar
router.put("/:id/renovar", async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const { Tiempo_Tarifa, fechaFin } = req.body;
    const cliente = await Cliente.findByIdAndUpdate(
      id,
      { Tiempo_Tarifa, fechaFin, fechaInicio: new Date() },
      { new: true }
    );
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

    req.body.asesorId = req.body.asesorId || cliente.asesorId;
    req.body.tipo = "EDITAR";
    await logMovimiento(req, `Tarifa renovada: ${cliente.nombre}, hasta ${fechaFin}`);

    res.json(cliente);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ────────────────────────────── Añadir historial progreso
router.put("/:id/historial", async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const cliente = await Cliente.findByIdAndUpdate(
      id,
      { $push: { historialProgreso: req.body } },
      { new: true }
    );
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

    req.body.asesorId = req.body.asesorId || cliente.asesorId;
    req.body.tipo = "PROGRESO";
    await logMovimiento(req, `Progreso añadido: ${cliente.nombre}`);

    res.json(cliente);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ────────────────────────────── Get by id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const cliente = await Cliente.findById(id);
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(cliente);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ────────────────────────────── Update by id
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const cliente = await Cliente.findByIdAndUpdate(id, req.body, { new: true });
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

    req.body.asesorId = req.body.asesorId || cliente.asesorId;
    req.body.tipo = "EDITAR";
    await logMovimiento(req, `Cliente actualizado: ${cliente.nombre}`);

    res.json(cliente);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ────────────────────────────── Delete by id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const cliente = await Cliente.findByIdAndDelete(id);
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

    req.body.asesorId = req.body.asesorId || cliente.asesorId;
    req.body.tipo = "BORRAR";
    await logMovimiento(req, `Cliente eliminado: ${cliente.nombre}`);

    res.json({ message: "Cliente eliminado" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ────────────────────────────── Toggle Estado (Baja/Activo)
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body; // "Activo" | "Baja"
    
    if (!["Activo", "Baja"].includes(estado)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    if (!Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const cliente = await Cliente.findByIdAndUpdate(
      id, 
      { estado },
      { new: true }
    );

    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

    req.body.asesorId = req.body.asesorId || cliente.asesorId;
    req.body.tipo = "EDITAR";
    await logMovimiento(req, `Cliente marcado como: ${estado} (${cliente.nombre})`);

    res.json(cliente);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});



router.get("/:id/avatar-measures", async (req, res) => {
  try {
    const ParamSchema = z.object({ id: z.string().length(24, "id inválido") });
    const QuerySchema = z.object({
      progress: z.enum(["last", "first"]).optional(),
      date: z.string().datetime().optional(),
    }).refine((q) => !(q.progress && q.date), {
      message: "Usa progress=last|first o date=ISO, pero no ambos.",
    });

    const { id } = ParamSchema.parse(req.params);
    const { progress, date } = QuerySchema.parse(req.query);

    const cliente = await Cliente.findById(id).lean();
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

    const historial = cliente.historialProgreso || [];
    const sorted = [...historial].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    let progreso;
    if (date) {
      const target = new Date(date).getTime();
      const past = sorted.filter(p => new Date(p.fecha).getTime() <= target);
      progreso = past[past.length - 1] || sorted[0];
    } else if (progress === "first") {
      progreso = sorted[0];
    } else {
      progreso = sorted[sorted.length - 1];
    }

    const musc = progreso?.musculo || [];
    const pick = (n) => musc.find(m => (m?.nombre || "").toLowerCase() === n.toLowerCase())?.medida;
    const cintura = (() => {
      const a = pick("CINTURA ANCHA");
      const b = pick("CINTURA ESTRECHA");
      return a && b ? (a + b) / 2 : a ?? b;
    })();
    const sanitize = (v, min = 10, max = 250) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return undefined;
      return Math.max(min, Math.min(max, n));
    };

    res.json({
      clienteId: String(cliente._id),
      progressDate: progreso?.fecha ?? null,
      sourceProgressId: progreso?._id ?? null,
      measures: {
        altura: sanitize(cliente.altura, 120, 230),
        peso: sanitize(progreso?.peso, 30, 250),
        pecho: sanitize(pick("Pecho")),
        espaldaAncho: sanitize(pick("Espalda")),
        cintura: sanitize(cintura),
        biceps: sanitize(pick("Brazo")),
        antebrazo: sanitize(pick("Antebrazo")),
        muslo: sanitize(pick("Pierna")),
        pantorrilla: sanitize(pick("Gemelo")),
      },
      modelRef: {
        altura: 175, pecho: 96, cintura: 78, cadera: 96,
        biceps: 32, antebrazo: 27, muslo: 55, pantorrilla: 37, espaldaAncho: 44,
      },
    });
  } catch (err) {
    const msg = err?.issues?.[0]?.message || err?.message || "Error";
    res.status(400).json({ error: msg });
  }
});

// ────────────────────────────── Session Counter Management
router.put("/:id/sesiones-counter", async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // "increment", "decrement", or "check-reset"

    const cliente = await Cliente.findById(id);
    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let budgetCreated = false;
    let resetOccurred = false;

    // Check if month changed and counter > 0 → create budget and reset
    if (cliente.sesionesLastMonth && cliente.sesionesLastMonth !== currentMonth && cliente.sesionesCounter > 0) {
      // Get "Sesión de entrenamiento" extra
      const Extra = require("../models/Extra");
      let sesionExtra = await Extra.findOne({ nombre: "Sesión de entrenamiento" });
      
      // Create extra if doesn't exist
      if (!sesionExtra) {
        sesionExtra = await Extra.create({
          nombre: "Sesión de entrenamiento",
          descripcion: "Sesión individual de entrenamiento",
          precio: 0, // Set default price, can be updated later
          activo: true
        });
      }

      // Calculate previous month dates
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      // Create extras-only budget
      const precioTotal = sesionExtra.precio * cliente.sesionesCounter;
      
      await Presupuesto.create({
        clienteId: cliente._id,
        nombreCliente: cliente.nombre,
        emailCliente: cliente.email,
        usuarioId: cliente.asesorId,
        tarifaId: null, // Extras-only budget
        extras: [{
          extraId: sesionExtra._id,
          precio: sesionExtra.precio,
          precioTotal
        }],
        total: precioTotal,
        descuento: 0,
        fechaInicio: prevMonth,
        fechaFin: lastDayPrevMonth,
        estado: "pendiente",
      });

      budgetCreated = true;
      resetOccurred = true;
      
      // Reset counter
      cliente.sesionesCounter = 0;
    }

    // Update last month if not set or if month changed
    if (!cliente.sesionesLastMonth || cliente.sesionesLastMonth !== currentMonth) {
      cliente.sesionesLastMonth = currentMonth;
    }

    // Handle increment/decrement
    if (action === "increment") {
      cliente.sesionesCounter += 1;
    } else if (action === "decrement" && cliente.sesionesCounter > 0) {
      cliente.sesionesCounter -= 1;
    }

    await cliente.save();

    res.json({
      sesionesCounter: cliente.sesionesCounter,
      sesionesLastMonth: cliente.sesionesLastMonth,
      budgetCreated,
      resetOccurred,
      currentMonth
    });
  } catch (err) {
    console.error("Error in sesiones-counter:", err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────── Listado por asesor
router.get("/asesor/:asesorId", async (req, res) => {
  try {
    const { asesorId } = req.params;

    // Validar ObjectId
    const isValid = Types.ObjectId.isValid(String(asesorId));
    if (!isValid) {
      return res.status(400).json({ error: "asesorId inválido" });
    }

    // Buscar clientes del asesor
    const clientes = await Cliente.find(
      { asesorId: new Types.ObjectId(asesorId) }
    ).lean();

    return res.json(clientes);
  } catch (err) {
    console.error("GET /clientes/asesor/:asesorId", err);
    res.status(500).json({ error: err.message });
  }
});




module.exports = router;
