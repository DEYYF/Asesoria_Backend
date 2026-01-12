const express = require("express");
const router = express.Router();
const Cita = require("../models/Cita");
const Cliente = require("../models/Cliente");
const auth = require("../middlewares/authMiddleware");
const { logMovimiento } = require("../utils/logMovimiento");
const { Types } = require("mongoose");
const validate = require("../middlewares/validate");
const {
  createCitaSchema,
  updateCitaSchema,
  bySlotQuerySchema,
} = require("../validators/citaSchemas");
const { sendEmail } = require("../utils/notifier");
const { triggerAutomations } = require("../utils/automationManager");

const {
  createTarea,
  updateTareaCita,
  deleteTareaCita,
  setTareaStatusByCita,
} = require("../utils/tareas");

// Listado por mes YYYY-MM
// Listado por mes YYYY-MM
router.get("/", auth, async (req, res) => {
  try {
    const isClient = req.user.role === 'client';
    const month = String(req.query?.month || "");
    
    let q = {};
    
    if (isClient) {
      // Clients only see their own appointments
      q.clienteId = req.user._id;
    } else {
      // Advisors see their own appointments (or filtered by query)
      const rawId = req.query?.asesorId || req.user._id; 
      if (rawId) {
        q.asesorId = Types.ObjectId.isValid(String(rawId))
            ? new Types.ObjectId(String(rawId))
            : String(rawId);
      }
    }

    // Filter by month if provided 'YYYY-MM'
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      q.date = { $regex: `^${month}` }; 
    }
    
    const items = await Cita.find(q)
      .sort({ date: 1, hora: 1 })
      .populate('clienteId', 'nombre') // Populate name
      .lean();

    // Remap to flatten structure if needed, or frontend handles it.
    // Frontend expects cita['clienteNombre'].
    // .lean() means clienteId will be an object { _id: ..., nombre: ... }
    const mappedItems = items.map(i => ({
      ...i,
      clienteNombre: i.clienteId ? i.clienteId.nombre : null,
      clienteId: i.clienteId ? i.clienteId._id : null
    }));

    res.json(mappedItems);
  } catch (e) {
    console.error("GET /citas", e);
    res.status(500).json({ message: "No se pudo cargar el calendario" });
  }
});

// Crear
router.post("/", auth, async (req, res) => {
  try {
    const rawId = req.user?._id || req.user?.id || req.body?.asesorId;
    const asesorId = Types.ObjectId.isValid(String(rawId))
      ? new Types.ObjectId(String(rawId))
      : String(rawId);
    const { title, date, hora, horaFin, clienteId, color } = req.body;
    const cita = await Cita.create({
      asesorId,
      title,
      date,
      hora,
      horaFin,
      clienteId: clienteId || undefined,
      color,
    });
    req.body.asesorId = asesorId; // para logMovimiento
    req.body.tipo = "CREAR";
    await logMovimiento(
      req,
      `Cita creada: ${title} (${date} ${hora || "hora no definida"}) -> ${
        horaFin ? horaFin : "sin hora fin"
      }`
    );

    // ✅ crear tarea asociada
    await createTarea(req, {
      title: `Cita: ${title}`,
      notes: `Fecha: ${date} ${hora || ""}${
        horaFin ? " - " + horaFin : ""
      }\nCliente ID: ${clienteId || "N/A"}`,
      status: "pending",
      dueAt: date,
      origin: "cita",
      clientId: clienteId || undefined,
      metadata: { citaId: cita._id.toString() },
    });

    // Automations trigger
    await triggerAutomations('APPOINTMENT_CREATED', {
      advisorId: asesorId,
      clientId: clienteId,
      appointmentId: cita._id
    });

    const cliente = clienteId ? await Cliente.findById(clienteId).lean() : null;
    const to = cliente?.email;
    if (to)
      await sendEmail({
        to: to,
        subject: `Nueva cita: ${title} (${date} ${hora || ""})`,
        text: `Se ha creado una nueva cita.\n\nAsesor ID: ${asesorId}\nTítulo: ${title}\nFecha: ${date}\nHora: ${
          hora || "N/A"
        }\nHora fin: ${horaFin || "N/A"}\nCliente ID: ${
          clienteId || "N/A"
        }\nCita ID: ${cita._id}\n\n--`,
      });

    res.json(cita);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Borra citas pasadas: fecha < hoy, o (fecha == hoy y horaFin < ahora)
router.delete("/purge-past", auth, async (req, res) => {
  try {
    const tzNow = new Date();
    const yyyy = tzNow.getFullYear();
    const mm = String(tzNow.getMonth() + 1).padStart(2, "0");
    const dd = String(tzNow.getDate()).padStart(2, "0");
    const todayISO = `${yyyy}-${mm}-${dd}`;
    const nowHM = `${String(tzNow.getHours()).padStart(2, "0")}:${String(
      tzNow.getMinutes()
    ).padStart(2, "0")}`;

    const asesorId = req.user?._id;
    const matchAsesor = asesorId ? { asesorId } : {};

    const result = await Cita.deleteMany({
      ...matchAsesor,
      $or: [
        { date: { $lt: todayISO } },
        { date: todayISO, horaFin: { $exists: true, $lt: nowHM } },
        { date: todayISO, horaFin: { $exists: false }, hora: { $lt: nowHM } },
      ],
    });

    res.json({ deleted: result.deletedCount });
  } catch (err) {
    console.error("DELETE /citas/purge-past", err);
    res.status(500).json({ message: "No se pudieron eliminar las citas pasadas" });
  }
});

router.get("/by-slot", async (req, res) => {
  try {
    const {
      from,
      to,
      weekday,
      startHour,
      endHour,
      asesorId,
      tz = "Europe/Madrid",
    } = req.query;
    if (!from || !to)
      return res
        .status(400)
        .json({ error: "from y to son requeridos (YYYY-MM-DD)" });
    if (weekday == null)
      return res.status(400).json({ error: "weekday (0..6) es requerido" });

    // Match principal (date es STRING 'YYYY-MM-DD')
    const match = {
      date: { $gte: String(from), $lte: String(to) },
    };
    if (asesorId) {
      match.asesorId = Types.ObjectId.isValid(String(asesorId))
        ? new Types.ObjectId(String(asesorId))
        : String(asesorId);
    }

    const sH = Number(startHour ?? 0);
    const eH = Number(endHour ?? 24);

    const data = await Cita.aggregate([
      { $match: match },

      // ── Parseo robusto de hora: soporta "09:00", "9:00", "09:00 -> 10:00", y espacios
      {
        $addFields: {
          horaPrimeraParte: {
            $let: {
              vars: { h: { $ifNull: ["$hora", ""] } },
              in: {
                $arrayElemAt: [
                  {
                    $split: [
                      {
                        $trim: {
                          input: {
                            $arrayElemAt: [{ $split: ["$$h", "->"] }, 0],
                          },
                        },
                      },
                      " ",
                    ],
                  },
                  0,
                ],
              },
            },
          },
        },
      },
      {
        $addFields: {
          hourStr: {
            $arrayElemAt: [{ $split: ["$horaPrimeraParte", ":"] }, 0],
          },
        },
      },
      {
        $addFields: {
          hour: {
            $convert: {
              input: "$hourStr",
              to: "int",
              onError: null,
              onNull: null,
            },
          },
        },
      },

      // ── Día de la semana local 0..6 (L..D) a partir de date (string)
      {
        $addFields: {
          dateObj: {
            $dateFromString: {
              dateString: "$date",
              format: "%Y-%m-%d",
              timezone: tz,
              onError: null,
            },
          },
        },
      },
      { $match: { dateObj: { $ne: null }, hour: { $ne: null } } },
      {
        $addFields: {
          dayOfWeek: { $mod: [{ $add: [{ $dayOfWeek: "$dateObj" }, 5] }, 7] }, // 1(dom)→6, 2(lun)→0 … 7(sab)→5
        },
      },

      // ── Filtro por celda clicada: día + franja horaria (startHour <= hour < endHour)
      {
        $match: {
          dayOfWeek: Number(weekday),
          hour: { $gte: sH, $lt: eH },
        },
      },

      // ── Join para nombre del cliente (opcional)
      {
        $lookup: {
          from: "clientes",
          localField: "clienteId",
          foreignField: "_id",
          as: "cliente",
        },
      },
      { $unwind: { path: "$cliente", preserveNullAndEmptyArrays: true } },

      // ── Proyección final
      {
        $project: {
          _id: 1,
          title: 1,
          date: 1,
          hora: 1,
          horaFin: 1,
          clienteId: 1,
          clienteNombre: "$cliente.nombre",
          color: 1,
        },
      },
      { $sort: { date: 1, hora: 1 } },
    ]);

    res.json({ items: data });
  } catch (e) {
    console.error("GET /citas/by-slot", e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/citas/:id/asistencia
router.put("/:id/asistencia", async (req, res) => {
  try {
    const { id } = req.params;
    let { asistio, action, asesorId } = req.body;

    // Permite payloads tipo { asistio: true } o { action: "confirm"|"cant" }
    if (typeof asistio !== "boolean") {
      if (action === "confirm") asistio = true;
      else if (action === "cant") asistio = false;
    }
    if (typeof asistio !== "boolean") {
      return res.status(400).json({ error: "Debes enviar asistio=true|false" });
    }

    const cita = await Cita.findByIdAndUpdate(
      id,
      { $set: { asistio } },
      { new: true }
    );
    if (!cita) return res.status(404).json({ error: "Cita no encontrada" });

    // log
    req.body.asesorId = asesorId;
    req.body.tipo = "CITA";
    await logMovimiento(
      req,
      `Asistencia ${asistio ? "confirmada" : "no asistirá"} para cita ${id} (${
        cita.date
      } ${cita.hora})`
    );

    // ✅ status tarea: done si asiste, pending si no
    await setTareaStatusByCita(req, id, asistio ? "done" : "pending");

    res.json({ ok: true, cita });
  } catch (e) {
    console.error("PUT /citas/:id/asistencia", e);
    res.status(500).json({ error: "No se pudo actualizar la asistencia" });
  }
});

// Update
router.put("/:id", auth, async (req, res) => {
  try {
    const { title, date, hora, horaFin, clienteId, color } = req.body;
    const cita = await Cita.findByIdAndUpdate(
      req.params.id,
      { title, date, hora, horaFin, clienteId: clienteId || undefined, color },
      { new: true }
    );
    if (!cita) return res.status(404).json({ message: "No encontrada" });

    req.body.asesorId = cita.asesorId; // para logMovimiento
    req.body.tipo = "EDITAR";
    await logMovimiento(
      req,
      `Cita editada: ${title} (${date} ${hora || "hora no definida"})`
    );

    const cliente = clienteId ? await Cliente.findById(clienteId).lean() : null;
    const to = cliente?.email;
    if (to)
      await sendEmail({
        to: to,
        subject: `Cita modificada: ${title} (${date} ${hora || ""})`,
        text: `Se ha modificado una cita.\n\nAsesor ID: ${
          cita.asesorId
        }\nTítulo: ${title}\nFecha: ${date}\nHora: ${
          hora || "N/A"
        }\nHora fin: ${horaFin || "N/A"}\nCliente ID: ${
          clienteId || "N/A"
        }\nCita ID: ${cita._id}\n\n--`,
      });

    // ✅ actualizar la tarea asociada
    await updateTareaCita(req, cita._id, {
      title: `Cita: ${title}`,
      notes: `Fecha: ${date} ${hora || ""}${
        horaFin ? " - " + horaFin : ""
      }\nCliente ID: ${clienteId || "N/A"}`,
      dueAt: date,
      clientId: clienteId || undefined,
      // status: lo dejamos como esté; se gestiona por asistencia
    });

    res.json(cita);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Delete
router.delete("/:id", auth, async (req, res) => {
  try {
    const out = await Cita.findByIdAndDelete(req.params.id);
    if (!out) return res.status(404).json({ message: "No encontrada" });

    req.body.asesorId = out.asesorId; // para logMovimiento
    req.body.tipo = "BORRAR";
    await logMovimiento(
      req,
      `Cita borrada: ${out.title} (${out.date} ${
        out.hora || "hora no definida"
      })`
    );

    // ✅ borra la tarea asociada
    await deleteTareaCita(req.params.id);

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

module.exports = router;
