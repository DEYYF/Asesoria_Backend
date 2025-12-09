const express = require("express");
const router = express.Router();
const Ejercicio = require("../models/Ejercicio"); // Ajusta la ruta si tu archivo está en otra carpeta
const { logMovimiento } = require('../utils/logMovimiento');

// ✅ Crear ejercicio
router.post("/", async (req, res) => {
  try {
    const nuevoEjercicio = new Ejercicio(req.body);
    const guardado = await nuevoEjercicio.save();
    req.body.asesorId = req.user?._id || req.body.asesorId; // para logMovimiento
    req.body.tipo = 'CREAR';
    await logMovimiento(`Ejercicio creado: ${guardado.nombre}`, req);
    res.status(201).json(guardado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ✅ Obtener todos los ejercicios
router.get("/", async (req, res) => {
  try {
    const {
      q,
      grupo,
      equipo,
      nivel,
      page = 1,
      limit = 50,
      sort = "nombre",
      order = "asc",
    } = req.query;

    const filter = {};

    // Texto: busca en nombre e instrucciones
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim(), "i");
      filter.$or = [{ nombre: rx }, { instrucciones: rx }];
    }
    if (grupo) filter.grupo = grupo;
    if (equipo) filter.equipo = equipo;
    if (nivel) filter.nivel = nivel;

    const orderNum = String(order).toLowerCase() === "desc" ? -1 : 1;
    const sortSpec = { [sort]: orderNum };

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Ejercicio.find(filter).sort(sortSpec).skip(skip).limit(limitNum),
      Ejercicio.countDocuments(filter),
    ]);

    res.json({
      items,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      limit: limitNum,
      sort,
      order: orderNum === 1 ? "asc" : "desc",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Obtener un ejercicio por ID
router.get("/:id", async (req, res) => {
  try {
    const ejercicio = await Ejercicio.findById(req.params.id);
    if (!ejercicio) return res.status(404).json({ error: "Ejercicio no encontrado" });
    res.json(ejercicio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Actualizar ejercicio
router.put("/:id", async (req, res) => {
  try {
    const actualizado = await Ejercicio.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!actualizado) return res.status(404).json({ error: "Ejercicio no encontrado" });
    req.body.asesorId = req.user?._id || req.body.asesorId; // para logMovimiento
    req.body.tipo = 'EDITAR';
    await logMovimiento(`Ejercicio actualizado: ${actualizado.nombre}`, req);
    res.json(actualizado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ✅ Eliminar ejercicio
router.delete("/:id", async (req, res) => {
  try {
    const eliminado = await Ejercicio.findByIdAndDelete(req.params.id);
    if (!eliminado) return res.status(404).json({ error: "Ejercicio no encontrado" });
    req.body.asesorId = req.user?._id || req.body.asesorId; // para logMovimiento
    req.body.tipo = 'BORRAR';
    await logMovimiento(`Ejercicio eliminado: ${eliminado.nombre}`, req);
    res.json({ message: "Ejercicio eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Obtener lista de grupos únicos
router.get("/listas/grupos", async (req, res) => {
  try {
    const grupos = await Ejercicio.distinct("grupo");
    res.json(grupos.filter(g => g).sort());
    } catch (error) {
    res.status(500).json({ error: error.message });
    }
});

// ✅ Obtener lista de equipos únicos
router.get("/listas/equipos", async (req, res) => {
    try {
        const equipos = await Ejercicio.distinct("equipo");
        res.json(equipos.filter(e => e).sort());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
    }
);  

// ✅ Obtener lista de niveles únicos
router.get("/listas/niveles", async (req, res) => {
    try {
        const niveles = await Ejercicio.distinct("nivel");
        res.json(niveles.filter(n => n).sort());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
    }
);



module.exports = router;

