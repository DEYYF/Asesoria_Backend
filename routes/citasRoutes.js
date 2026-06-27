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
const { syncToGoogle, deleteFromGoogle } = require("../services/googleCalendarService");
const Usuario = require("../models/Usuario");

const {
  createTarea,
  updateTareaCita,
  deleteTareaCita,
  setTareaStatusByCita,
} = require("../utils/tareas");

// Helper to get Monday of a week (normalized to 00:00:00.000 local time)
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Listado por mes YYYY-MM
// Listado por mes YYYY-MM
router.get("/", auth, async (req, res) => {
  try {
    const isClient = req.user.role === 'client';
    const month = String(req.query?.month || "");
    const start = String(req.query?.start || "");
    const end = String(req.query?.end || "");
    
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
    } else if (start || end) {
      q.date = {};
      if (start) q.date.$gte = start;
      if (end) q.date.$lte = end;
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

    // Dynamic workouts injection
    const targetClienteId = req.query.clienteId || (isClient ? req.user._id : null);
    if (targetClienteId && Types.ObjectId.isValid(String(targetClienteId))) {
      const Entrenamiento = require("../models/Entrenamiento");
      const activeWorkouts = await Entrenamiento.find({ 
        clienteId: new Types.ObjectId(String(targetClienteId)),
        activo: true 
      })
      .populate({
        path: "semanas.dias.items.ejercicio",
        select: "nombre grupo equipo nivel urlVideo instrucciones",
      })
      .lean();

      // Find range start and end
      let rangeStart, rangeEnd;
      if (month && /^\d{4}-\d{2}$/.test(month)) {
        rangeStart = new Date(`${month}-01T00:00:00`);
        rangeEnd = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + 1, 0, 23, 59, 59);
      } else if (start || end) {
        rangeStart = start ? new Date(start + "T00:00:00") : new Date();
        rangeEnd = end ? new Date(end + "T23:59:59") : new Date();
      } else {
        // default 1 month
        const now = new Date();
        rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
        rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }

      for (const workout of activeWorkouts) {
        const routineStart = workout.fechaInicio ? new Date(workout.fechaInicio) : new Date(workout.createdAt);
        routineStart.setHours(0,0,0,0);

        // Monday of the week of routine start
        const routineStartMonday = getMonday(routineStart);

        // Loop through each day in the range
        let currentDay = new Date(rangeStart);
        while (currentDay <= rangeEnd) {
          const currentMonday = getMonday(currentDay);
          const msPerWeek = 7 * 24 * 60 * 60 * 1000;
          const weeksElapsed = Math.round((currentMonday - routineStartMonday) / msPerWeek);

          if (weeksElapsed >= 0) {
            const weekNum = weeksElapsed + 1;
            // Find week or cycle
            let targetWeek = workout.semanas.find(s => s.numero === weekNum);
            if (!targetWeek && workout.semanas.length > 0) {
              const cycleIndex = weeksElapsed % workout.semanas.length;
              targetWeek = workout.semanas[cycleIndex];
            }

            if (targetWeek) {
              const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
              const currentDayName = weekdays[currentDay.getDay()];
              
              // Find matching training day(s) for this weekday
              (targetWeek.dias || []).forEach((dia, diaIndex) => {
                if (dia.diaSemana && dia.diaSemana.toLowerCase() === currentDayName.toLowerCase()) {
                  // Format the exercises
                  const exercisesList = (dia.items || []).map(it => ({
                    nombre: it.ejercicio?.nombre || "Ejercicio",
                    series: it.esquema?.series || 3,
                    repsMin: it.esquema?.repsMin || 8,
                    repsMax: it.esquema?.repsMax || 12,
                    rir: it.esquema?.rir ?? 1,
                    descanso: it.esquema?.descanso ?? 90,
                    notas: it.esquema?.notas || "",
                    urlVideo: it.ejercicio?.urlVideo || "",
                    instrucciones: it.ejercicio?.instrucciones || ""
                  }));

                  // Map date to string 'YYYY-MM-DD'
                  const yyyy = currentDay.getFullYear();
                  const mm = String(currentDay.getMonth() + 1).padStart(2, "0");
                  const dd = String(currentDay.getDate()).padStart(2, "0");
                  const dateStr = `${yyyy}-${mm}-${dd}`;

                  mappedItems.push({
                    _id: `workout-${workout._id}-${weekNum}-${diaIndex}-${dateStr}`,
                    title: `🏋️‍♂️ Entrenar: ${dia.nombre}`,
                    date: dateStr,
                    hora: "08:00",
                    horaFin: "09:30",
                    clienteId: targetClienteId,
                    clienteNombre: workout.clienteId?.nombre || "",
                    color: "#a78bfa",
                    isWorkout: true,
                    workoutId: workout._id,
                    semanaIdx: workout.semanas.indexOf(targetWeek),
                    diaIdx: diaIndex,
                    exercises: exercisesList,
                    notas: `Rutina: ${workout.titulo}\nObjetivo: ${workout.objetivo || ""}`
                  });
                }
              });
            }
          }
          currentDay.setDate(currentDay.getDate() + 1);
        }
      }
    }

    res.json(mappedItems);
  } catch (e) {
    console.error("GET /citas", e);
    res.status(500).json({ message: "No se pudo cargar el calendario" });
  }
});

// Crear
router.post("/", auth, async (req, res) => {
  try {
    const rawId = req.body?.asesorId || req.user?._id || req.user?.id;
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
      assigneeId: asesorId, // Aseguramos que se asigne al asesor de la cita
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
    if (to) {
      const { sendTemplateEmail } = require('../utils/emailTemplates');
      await sendTemplateEmail(asesorId, 'citaCreated', to, {
        clienteNombre: cliente.nombre,
        titulo: title,
        fecha: date,
        hora: hora || 'N/A',
        horaFin: horaFin || 'N/A'
      });
    }

    // ✅ Sync to Google Calendar
    try {
      const user = await Usuario.findById(asesorId);
      if (user) await syncToGoogle(user, cita);
    } catch (err) {
      console.error("Error syncing to Google:", err);
    }

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

router.get("/by-slot", auth, async (req, res) => {
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
router.put("/:id/asistencia", auth, async (req, res) => {
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

    // Automation Triggers
    if (asistio) {
      await triggerAutomations('APPOINTMENT_CONFIRMED', {
        advisorId: asesorId || cita.asesorId,
        clientId: cita.clienteId,
        appointmentId: cita._id
      });
    } else {
      await triggerAutomations('APPOINTMENT_CANCELLED', {
        advisorId: asesorId || cita.asesorId,
        clientId: cita.clienteId,
        appointmentId: cita._id
      });
    }

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
    if (to) {
      const { sendTemplateEmail } = require('../utils/emailTemplates');
      await sendTemplateEmail(cita.asesorId, 'citaUpdated', to, {
        clienteNombre: cliente.nombre,
        titulo: title,
        fecha: date,
        hora: hora || 'N/A'
      });
    }

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

    // ✅ Sync to Google Calendar
    try {
      const user = await Usuario.findById(cita.asesorId);
      if (user) await syncToGoogle(user, cita);
    } catch (err) {
      console.error("Error syncing to Google (update):", err);
    }

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

    // ✅ Sync to Google Calendar (Delete)
    try {
      if (out.googleEventId) {
        const user = await Usuario.findById(out.asesorId);
        if (user) await deleteFromGoogle(user, out.googleEventId);
      }
    } catch (err) {
      console.error("Error deleting from Google:", err);
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

module.exports = router;
