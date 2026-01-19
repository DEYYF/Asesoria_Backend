// routes/statsRoutes.js
const express = require("express");
const router = express.Router();
const { Types } = require("mongoose");
const authMiddleware = require("../middlewares/authMiddleware");

const Cita = require("../models/Cita");
const Cliente = require("../models/Cliente");
const Dieta = require("../models/Dieta");
const Entrenamiento = require("../models/Entrenamiento");

// Helpers
const clampTZ = (tz) => (tz && typeof tz === "string" ? tz : "Europe/Madrid");

const enforceAsesorMatch = (req) => {
  const { asesorId: queryAsesorId } = req.query;
  const isSuperAdmin = req.user?.role === 'superadmin';

  // If not superadmin, must use own ID
  const effectiveAsesorId = isSuperAdmin ? queryAsesorId : req.user.id;

  if (!effectiveAsesorId) return {};
  return {
    asesorId: Types.ObjectId.isValid(String(effectiveAsesorId))
      ? new Types.ObjectId(String(effectiveAsesorId))
      : String(effectiveAsesorId),
  };
};

router.use(authMiddleware);

/**
 * GET /api/stats/dashboard
 * KPIs rápidos del dashboard
 */
router.get("/dashboard", async (req, res) => {
  try {
    const matchByAsesor = enforceAsesorMatch(req);
    const now = new Date();

    const totalClientes = await Cliente.countDocuments(matchByAsesor);

    const activosAgg = await Cliente.aggregate([
      { $match: matchByAsesor },
      { $addFields: { fin: { $toDate: "$fechaFin" } } },
      { $match: { fin: { $gt: now } } },
      { $count: "n" },
    ]);
    const clientesActivos = activosAgg[0]?.n || 0;

    const [totalDietas, totalEntrenamientos] = await Promise.all([
      Dieta.countDocuments(matchByAsesor),
      Entrenamiento.countDocuments(matchByAsesor),
    ]);

    res.json({ totalClientes, clientesActivos, totalDietas, totalEntrenamientos });
  } catch (e) {
    console.error("GET /stats/dashboard", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/stats/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&asesorId=&tz=
 * Tasa de asistencia, no-shows, total
 */
router.get("/attendance", async (req, res) => {
  try {
    const { from, to, tz } = req.query;
    const timezone = clampTZ(tz);
    const matchAsesor = enforceAsesorMatch(req);

    const pipeline = [
      ...(Object.keys(matchAsesor).length ? [{ $match: matchAsesor }] : []),

      // Normaliza 'date' a 'dateObj' (Date | "YYYY-MM-DD" | "DD/MM/YYYY")
      { $addFields: { _dateType: { $type: "$date" } } },
      {
        $addFields: {
          dateObj: {
            $cond: [
              { $eq: ["$_dateType", "date"] },
              "$date",
              {
                $cond: [
                  { $regexMatch: { input: "$date", regex: /\// } }, // dd/mm/yyyy
                  { $dateFromString: { dateString: "$date", format: "%d/%m/%Y", timezone, onError: null } },
                  {
                    $dateFromString: {
                      dateString: "$date",
                      format: "%Y-%m-%d",
                      timezone,
                      onError: { $dateFromString: { dateString: "$date", timezone, onError: null } },
                    },
                  },
                ],
              },
            ],
          },
        },
      },

      // Filtro por rango (si llega)
      ...(from || to
        ? [
            {
              $match: {
                $expr: {
                  $and: [
                    ...(from
                      ? [
                          {
                            $gte: [
                              "$dateObj",
                              {
                                $dateFromString: {
                                  dateString: from,
                                  format: "%Y-%m-%d",
                                  timezone,
                                },
                              },
                            ],
                          },
                        ]
                      : []),
                    ...(to
                      ? [
                          {
                            $lt: [
                              "$dateObj",
                              {
                                $dateAdd: {
                                  startDate: {
                                    $dateFromString: {
                                      dateString: to,
                                      format: "%Y-%m-%d",
                                      timezone,
                                    },
                                  },
                                  unit: "day",
                                  amount: 1,
                                },
                              },
                            ],
                          },
                        ]
                      : []),
                  ],
                },
              },
            },
          ]
        : []),

      // Métricas
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          attended: { $sum: { $cond: [{ $eq: ["$asistio", true] }, 1, 0] } },
          noShow: { $sum: { $cond: [{ $eq: ["$asistio", false] }, 1, 0] } },
        },
      },
    ];

    const rows = await Cita.aggregate(pipeline);
    const { total = 0, attended = 0, noShow = 0 } = rows[0] || {};
    const attendanceRate = total ? Math.round((attended / total) * 100) : 0;
    res.json({ total, attended, noShow, attendanceRate });
  } catch (e) {
    console.error("GET /stats/attendance", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/stats/renewals?month=YYYY-MM
 * Renovaciones registradas ese mes (fechaFin dentro del mes)
 */
router.get("/renewals", async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: "month requerido (YYYY-MM)" });

    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const next = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));

    const matchByAsesor = enforceAsesorMatch(req);

    const rows = await Cliente.aggregate([
      { $match: matchByAsesor },
      { $addFields: { fin: { $toDate: "$fechaFin" } } },
      { $match: { fin: { $gte: start, $lt: next } } },
      { $count: "renewals" },
    ]);

    res.json({ month, renewals: rows[0]?.renewals || 0 });
  } catch (e) {
    console.error("GET /stats/renewals", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/stats/agenda-heatmap?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=Europe/Madrid&asesorId=
 * Devuelve [{ _id:{d,h}, count }] donde d=0..6 (L..D), h=0..23
 */
// GET /api/stats/agenda-heatmap?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=Europe/Madrid&asesorId=
router.get("/agenda-heatmap", async (req, res) => {
  try {
    const match = enforceAsesorMatch(req);

    // Rango por STRING (YYYY-MM-DD) — fiable con tu esquema
    if (from) match.date = { ...(match.date || {}), $gte: from };
    if (to)   match.date = { ...(match.date || {}), $lte: to };

    const data = await Cita.aggregate([
      { $match: match },

      // hour: 0..23 (soporta "09:20", "9:05")
      {
        $addFields: {
          hour: {
            $convert: {
              input: { $arrayElemAt: [{ $split: [{ $ifNull: ["$hora", "" ] }, ":" ] }, 0] },
              to: "int",
              onError: null,
              onNull: null
            }
          },
          // dateObj solo para calcular el día de la semana
          dateObj: {
            $dateFromString: {
              dateString: "$date",
              format: "%Y-%m-%d",
              timezone: tz,
              onError: null
            }
          }
        }
      },

      // descarta registros sin hora o sin fecha válida
      { $match: { hour: { $ne: null }, dateObj: { $ne: null } } },

      // día de la semana local 0..6 (L..D)
      {
        $addFields: {
          dayOfWeek: {
            $mod: [
              { $add: [ { $dayOfWeek: "$dateObj" }, 5 ] }, // 1(dom)->6, 2(lun)->0, ..., 7(sáb)->5
              7
            ]
          }
        }
      },

      { $group: { _id: { d: "$dayOfWeek", h: "$hour" }, count: { $sum: 1 } } },
      { $sort: { "_id.d": 1, "_id.h": 1 } }
    ]);

    res.json({ data });
  } catch (e) {
    console.error("GET /stats/agenda-heatmap", e);
    res.status(500).json({ error: e.message });
  }
});


/**
 * GET /api/stats/funnel?asesorId=
 * Embudo: total → con 1ª cita → con plan (dieta/entreno) → renovados
 */
router.get("/funnel", async (req, res) => {
  try {
    const matchCliente = enforceAsesorMatch(req);
    // Use asesorId from the match if it exists
    const matchAsesorId = matchCliente.asesorId;

    // ids de clientes de este asesor (si aplica)
    const ids = await Cliente.find(matchCliente).select("_id").lean();
    const clienteIds = ids.map((x) => x._id);

    const totalClientes = clienteIds.length || (await Cliente.countDocuments(matchCliente));

    const matchInIds = clienteIds.length ? { clienteId: { $in: clienteIds } } : {};
    const [citasIds, dietaIds, entrenoIds] = await Promise.all([
      Cita.distinct("clienteId", matchInIds),
      Dieta.distinct("clienteId", matchInIds),
      Entrenamiento.distinct("clienteId", matchInIds),
    ]);

    const setPlan = new Set([...dietaIds.map(String), ...entrenoIds.map(String)]);

    const renovadosRows = await Cliente.aggregate([
      { $match: matchCliente },
      { $addFields: { fin: { $toDate: "$fechaFin" } } },
      { $match: { fin: { $gt: new Date() } } },
      { $count: "renovados" },
    ]);

    res.json({
      totalClientes,
      conPrimeraCita: (citasIds || []).length,
      conPlan: setPlan.size,
      renovados: renovadosRows[0]?.renovados || 0,
    });
  } catch (e) {
    console.error("GET /stats/funnel", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
