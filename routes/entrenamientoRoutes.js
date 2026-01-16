const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Entrenamiento = require("../models/Entrenamiento");
const { logMovimiento } = require('../utils/logMovimiento');

// ✅ Crear
router.post("/", async (req, res) => {
  try {
    const doc = await Entrenamiento.create(req.body);
    req.body.asesorid = req.user?._id || req.body.asesorid; // para logMovimiento
    req.body.tipo = 'CREAR';
    await logMovimiento(`Entrenamiento creado: ${doc.titulo}`, req);
    
    // Automation: WORKOUT_ASSIGNED
    if (doc.asesorid && doc.clienteId) {
        const { triggerAutomations } = require("../utils/automationManager");
        await triggerAutomations('WORKOUT_ASSIGNED', {
            advisorId: doc.asesorid,
            clientId: doc.clienteId,
            data: { workoutId: doc._id }
        });
    }
    
    res.status(201).json(doc);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ✅ Listado general (ligero, sin populate)
router.get("/", async (req, res) => {
  try {
    const { clienteId } = req.query;
    const filter = {};
    if (clienteId) filter.clienteId = clienteId;

    const items = await Entrenamiento.find(filter, {                      // proyección ligera
      titulo: 1,
      objetivo: 1,
      clienteId: 1,
      asesorid: 1,
      activo: 1,
      createdAt: 1,
      updatedAt: 1,
      semanas: { $slice: 1 }, // no enviar todo (solo para no pesar)
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Listado por cliente (para PrevisualizacionEntrenamientos)
router.get("/cliente/:clienteId", async (req, res) => {
  try {
    const { clienteId } = req.params;
    if (!mongoose.isValidObjectId(clienteId)) {
      return res.status(400).json({ error: "clienteId inválido" });
    }

    // Agregación para devolver contadores listos (semanas, días, ejercicios)
    const items = await Entrenamiento.aggregate([
      { $match: { clienteId: new mongoose.Types.ObjectId(clienteId) } },
      {
        $project: {
          titulo: 1,
          objetivo: 1,
          clienteId: 1,
          asesorid: 1,
          activo: 1,
          createdAt: 1,
          updatedAt: 1,
          semanasCount: { $size: { $ifNull: ["$semanas", []] } },
          diasCount: {
            $sum: {
              $map: {
                input: { $ifNull: ["$semanas", []] },
                as: "sem",
                in: { $size: { $ifNull: ["$$sem.dias", []] } },
              },
            },
          },
          ejerciciosCount: {
            $sum: {
              $map: {
                input: { $ifNull: ["$semanas", []] },
                as: "sem",
                in: {
                  $sum: {
                    $map: {
                      input: { $ifNull: ["$$sem.dias", []] },
                      as: "dia",
                      in: { $size: { $ifNull: ["$$dia.items", []] } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      { $sort: { createdAt: -1, updatedAt: -1 } },
      { $limit: parseInt(req.query.limit ?? 100, 10) },
    ]);

    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Detalle por ID (populate profundo SOLO aquí)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const doc = await Entrenamiento.findById(id)
      .populate({
        path: "semanas.dias.items.ejercicio",
        select: "nombre grupo equipo nivel urlVideo instrucciones",
      })
      .lean();

    if (!doc) return res.status(404).json({ error: "Entrenamiento no encontrado" });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Actualizar
router.put("/:id", async (req, res) => {
  try {
    const doc = await Entrenamiento.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!doc) return res.status(404).json({ error: "Entrenamiento no encontrado" });
    req.body.asesorid = req.user?._id || req.body.asesorid; // para logMovimiento
    req.body.tipo = 'EDITAR';
    await logMovimiento(`Entrenamiento actualizado: ${doc.titulo}`, req);
    res.json(doc);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ✅ Eliminar
router.delete("/:id", async (req, res) => {
  try {
    const doc = await Entrenamiento.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "Entrenamiento no encontrado" });
    req.body.asesorId = req.user?._id || req.body.asesorId; // para logMovimiento
    req.body.tipo = 'BORRAR';
    await logMovimiento(`Entrenamiento eliminado: ${doc.titulo}`, req);
    res.json({ message: "Entrenamiento eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// GET /entrenamientos/ultimo?asesor=:id
router.get('/ultimo', async (req, res) => {
  try {
    const { asesorId } = req.params;

    const ultima = await Entrenamiento.findOne({ asesorid: asesorId })
      .sort({ createdAt: -1, _id: -1 })
      .populate('clienteId', 'nombre') // para clienteNombre
      .lean();

    if (!ultima) return res.json({});

    return res.json({
      _id: ultima._id,
      createdAt: ultima.createdAt,
      updatedAt: ultima.updatedAt,
      titulo: ultima.titulo,
      clienteId: ultima.clienteId?._id || ultima.clienteId,
      clienteNombre: ultima.clienteId?.nombre || undefined,
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener el ultimo entrenamiento" });
  }
});



const EntrenamientoRegistro = require("../models/EntrenamientoRegistro");

// ✅ Crear Registro (Notebook)
router.post("/registros", async (req, res) => {
  try {
    const doc = await EntrenamientoRegistro.create(req.body);
    
    // Automation: WORKOUT_COMPLETED
    if (doc.clienteId) {
      const { triggerAutomations } = require("../utils/automationManager");
      const entrenamiento = await Entrenamiento.findById(doc.entrenamientoId).select('asesorid').lean();
      if (entrenamiento && entrenamiento.asesorid) {
        await triggerAutomations('WORKOUT_COMPLETED', {
          advisorId: entrenamiento.asesorid,
          clientId: doc.clienteId,
          data: { registroId: doc._id, entrenamientoId: doc.entrenamientoId }
        });
      }
    }
    
    res.status(201).json(doc);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ✅ Listar Registros de un Entrenamiento
router.get("/registros/:entrenamientoId", async (req, res) => {
  try {
    const { entrenamientoId } = req.params;
    const docs = await EntrenamientoRegistro.find({ entrenamientoId })
      .sort({ fecha: -1 })
      .populate("ejercicios.ejercicio", "nombre")
      .lean();
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Listar Ejercicios Unicos registrados por cliente
router.get("/registros/cliente/:clienteId/ejercicios", async (req, res) => {
  try {
     const { clienteId } = req.params;
     // Usamos distinct para sacar nombres o IDs de ejercicios usados
     // Nota: Como "ejercicios" es un array en EntrenamientoRegistro, el distinct puede ser complejo.
     // Haremos un aggregate más robusto.
     const list = await EntrenamientoRegistro.aggregate([
        { $match: { clienteId: new mongoose.Types.ObjectId(clienteId) } },
        { $unwind: "$ejercicios" },
        { 
            $group: { 
                _id: "$ejercicios.ejercicioNombre", // Agrupamos por nombre (o ID si prefieres)
                lastDate: { $max: "$fecha" }
            } 
        },
        { $sort: { lastDate: -1 } }
     ]);
     // list => [{ _id: "Sentadilla", lastDate: ... }]
     res.json(list.map(l => l._id).filter(Boolean));
  } catch (error) {
     res.status(500).json({ error: error.message });
  }
});

// ✅ Get ALL training session records for a client (for Journal/Bitácora)
router.get("/registros/cliente/:clienteId/sesiones", async (req, res) => {
  try {
    const { clienteId } = req.params;
    
    if (!mongoose.isValidObjectId(clienteId)) {
      return res.status(400).json({ error: "clienteId inválido" });
    }
    
    const sessions = await EntrenamientoRegistro.find({ 
      clienteId: new mongoose.Types.ObjectId(clienteId) 
    })
      .sort({ fecha: -1 })
      .select("fecha ejercicios comentarios semanaNumero diaNombre")
      .lean();
    
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Historial de un ejercicio específico
router.get("/registros/cliente/:clienteId/historial", async (req, res) => {
    try {
        const { clienteId } = req.params;
        const { ejercicio } = req.query; // Nombre del ejercicio

        if (!ejercicio) return res.json([]);

        const logs = await EntrenamientoRegistro.find({ 
            clienteId, 
            "ejercicios.ejercicioNombre": ejercicio 
        })
        .sort({ fecha: 1 })
        .select("fecha ejercicios")
        .lean();

        // Procesar para sacar solo la data relevante
        const data = logs.map(log => {
            // Buscar el ejercicio dentro del array
            const target = log.ejercicios.find(e => e.ejercicioNombre === ejercicio);
            if (!target) return null;
            
            // Calculamos algo representativo, ej: 1RM estimado más alto del día o peso máximo
            // Epley formula: w * (1 + r/30)
            let max1RM = 0;
            let maxWeight = 0;
            let totalVolume = 0;
            let maxReps = 0;
            
            target.series.forEach(s => {
                const w = s.peso || 0;
                const r = s.reps || 0;
                
                if (w > maxWeight) maxWeight = w;
                if (r > maxReps) maxReps = r;
                
                totalVolume += w * r;

                const e1rm = w * (1 + r/30);
                if (e1rm > max1RM) max1RM = e1rm;
            });

            return {
                fecha: log.fecha,
                maxWeight,
                estimated1RM: max1RM,
                totalVolume,
                maxReps
            };
        }).filter(Boolean);

        res.json(data);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// ✅ Heatmap: Medidas corporales (último registro)
// ✅ Heatmap: Medidas corporales (último registro o específico por ID)
router.get("/registros/cliente/:clienteId/medidas-heatmap", async (req, res) => {
    try {
        const { clienteId } = req.params;
        const { progressId } = req.query; // Optional: specify which entry to load

        const cliente = await mongoose.model("Cliente").findById(clienteId).select("historialProgreso");

        if (!cliente || !cliente.historialProgreso || cliente.historialProgreso.length === 0) {
            return res.json({});
        }

        let targetEntry;

        if (progressId) {
             targetEntry = cliente.historialProgreso.find(p => p._id.toString() === progressId);
        }
        
        // If not found or not specified, use latest
        if (!targetEntry) {
             targetEntry = cliente.historialProgreso.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0];
        }

        if (!targetEntry) return res.json({});
        
        // Transformar array de musculos a objeto { "Pecho": 100, ... }
        const result = {};
        if (targetEntry.musculo) {
            targetEntry.musculo.forEach(m => {
                if (m.medida) result[m.nombre] = m.medida;
            });
        }
        
        if (targetEntry.peso) result["Peso"] = targetEntry.peso;
        if (targetEntry.grasaCorporal) result["Grasa"] = targetEntry.grasaCorporal;
        if (targetEntry.MasaMusculoEsqueletica) result["MasaMusculoEsqueletica"] = targetEntry.MasaMusculoEsqueletica;

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ Listado de Fechas de Progreso (para el selector)
router.get("/registros/cliente/:clienteId/fechas-medidas", async (req, res) => {
    try {
        const { clienteId } = req.params;
        const cliente = await mongoose.model("Cliente").findById(clienteId).select("historialProgreso");

        if (!cliente || !cliente.historialProgreso) {
            return res.json([]);
        }

        // Return array of { _id, fecha } sorted desc
        const dates = cliente.historialProgreso
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .map(p => ({
                _id: p._id,
                fecha: p.fecha
            }));

        res.json(dates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
