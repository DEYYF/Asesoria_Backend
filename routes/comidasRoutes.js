// routes/comidas.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Receta = require("../models/Recetas");
const Combinacion = require("../models/Combinaciones");
const Ingrediente = require("../models/Ingredientes");
const { logMovimiento } = require('../utils/logMovimiento');

/* =========================
   HELPERS
========================= */
const trim = (s) => (typeof s === "string" ? s.trim() : s);
const isId = (v) => v && mongoose.Types.ObjectId.isValid(v);

/* =========================
   INGREDIENTES
========================= */
// Crear (no duplica si existe por nombre; compara case-insensitive)
router.post("/ingredientes", async (req, res) => {
  try {
    const payload = { ...req.body, nombre: trim(req.body?.nombre || "") };
    if (!payload.nombre) return res.status(400).json({ error: "Nombre requerido" });
    

    // ¿Existe?
    const existente = await Ingrediente.findOne({ nombre: payload.nombre })
      .collation({ locale: "es", strength: 2 });
    if (existente) {
      return res.status(200).json({
        ...existente.toObject(),
        existing: true,
        message: "El ingrediente ya existía; se ha reutilizado.",
      });
    }

    const creado = await Ingrediente.create(payload);

    req.body.asesorId = req.user?._id; // para logMovimiento
    req.body.tipo = "CREAR"; // para logMovimiento
    await logMovimiento(req, `Ingrediente creado: ${creado.nombre} (ID: ${creado._id})`);
    return res.json(creado);
  } catch (err) {
    // Si salta índice único
    if (err?.code === 11000) {
      const existente = await Ingrediente.findOne({ nombre: trim(req.body?.nombre || "") })
        .collation({ locale: "es", strength: 2 });
      return res.status(200).json({
        ...existente.toObject(),
        existing: true,
        message: "El ingrediente ya existía; se ha reutilizado.",
      });
    }
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

router.get("/ingredientes", async (req, res) => {
  try {
    const ingredientes = await Ingrediente.find()
      .sort({ nombre: 1 })
      .lean();
    res.json(ingredientes);
  } catch (err) {
    console.error("Error al obtener ingredientes:", err);
    res.status(500).json({ error: "Error al obtener ingredientes" });
  }
});

// Editar (impide renombrar a un duplicado)
router.put("/ingredientes/:id", async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.nombre) update.nombre = trim(update.nombre);

    if (update.nombre) {
      const dupe = await Ingrediente.findOne({
        _id: { $ne: req.params.id },
        nombre: update.nombre,
      }).collation({ locale: "es", strength: 2 });
      if (dupe) return res.status(409).json({ error: "Ya existe un ingrediente con ese nombre" });
    }

    const ingrediente = await Ingrediente.findByIdAndUpdate(req.params.id, update, { new: true });
    req.body.asesorId = req.user?._id; // para logMovimiento
    req.body.tipo = "EDITAR"; // para logMovimiento
    await logMovimiento(req, `Ingrediente editado: ${ingrediente.nombre} (ID: ${ingrediente._id})`);
    res.json(ingrediente);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Ya existe un ingrediente con ese nombre" });
    }
    res.status(400).json({ error: err.message });
  }
});

router.delete("/ingredientes/:id", async (req, res) => {
  try {
    await Ingrediente.findByIdAndDelete(req.params.id);

    req.body.asesorId = req.user?._id; // para logMovimiento
    req.body.tipo = "BORRAR";
    await logMovimiento(req, `Ingrediente eliminado: ID ${req.params.id}`);
    res.json({ mensaje: "Ingrediente eliminado" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* =========================
   COMBINACIONES (sin cambios funcionales)
========================= */
router.post("/combinaciones", async (req, res) => {
  try {
    const { nombre, ingredientes } = req.body;

    const ingredientesDB = await Promise.all(
      (ingredientes || []).map(async ({ ingrediente, gramos }) => {
        const ing = await Ingrediente.findById(ingrediente);
        if (!ing) throw new Error("Ingrediente no encontrado");
        const f = (Number(gramos) || 0) / 100;
        return {
          ingrediente,
          gramos,
          calorias: ing.kcal * f,
          proteinas: ing.proteinas * f,
          carbohidratos: ing.carbohidratos * f,
          grasas: ing.grasas * f,
        };
      })
    );

    const totales = ingredientesDB.reduce(
      (acc, ing) => ({
        calorias: acc.calorias + (ing.calorias || 0),
        proteinas: acc.proteinas + (ing.proteinas || 0),
        carbohidratos: acc.carbohidratos + (ing.carbohidratos || 0),
        grasas: acc.grasas + (ing.grasas || 0),
      }),
      { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }
    );

    const nueva = await Combinacion.create({
      nombre: trim(nombre),
      ingredientes,
      caloriasTotales: +totales.calorias.toFixed(2),
      macrosTotales: {
        proteinas: +totales.proteinas.toFixed(2),
        carbohidratos: +totales.carbohidratos.toFixed(2),
        grasas: +totales.grasas.toFixed(2),
      },
    });

    req.body.asesorId = req.user?._id; // para logMovimiento
    req.body.tipo = "CREAR"; // para logMovimiento
    await logMovimiento(req, `Combinación creada: ${nueva.nombre} (ID: ${nueva._id})`);
    res.json(nueva);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/combinaciones", async (req, res) => {
  try {
    const combinaciones = await Combinacion.find()
      .sort({ nombre: 1 })
      .populate("ingredientes.ingrediente")
      .lean();

    const out = combinaciones.map((c) => ({
      id: c._id,
      nombre: c.nombre,
      caloriasTotales: c.caloriasTotales,
      macrosTotales: c.macrosTotales,
      ingredientes: (c.ingredientes || []).map((i) => ({
        nombre: i.ingrediente?.nombre || "Desconocido",
        gramos: i.gramos,
      })),
    }));

    res.json(out);
  } catch (error) {
    console.error("Error al obtener combinaciones:", error);
    res.status(500).json({ error: "Error al obtener combinaciones" });
  }
});

router.put("/combinaciones/:id", async (req, res) => {
  try {
    const { nombre, ingredientes } = req.body;

    const ingredientesDB = await Promise.all(
      (ingredientes || []).map(async ({ ingrediente, gramos }) => {
        const ing = await Ingrediente.findById(ingrediente);
        if (!ing) throw new Error("Ingrediente no encontrado");
        const f = (Number(gramos) || 0) / 100;
        return {
          ingrediente,
          gramos,
          calorias: ing.kcal * f,
          proteinas: ing.proteinas * f,
          carbohidratos: ing.carbohidratos * f,
          grasas: ing.grasas * f,
        };
      })
    );

    const totales = ingredientesDB.reduce(
      (acc, ing) => ({
        calorias: acc.calorias + (ing.calorias || 0),
        proteinas: acc.proteinas + (ing.proteinas || 0),
        carbohidratos: acc.carbohidratos + (ing.carbohidratos || 0),
        grasas: acc.grasas + (ing.grasas || 0),
      }),
      { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }
    );

    const combinacion = await Combinacion.findByIdAndUpdate(
      req.params.id,
      {
        nombre: trim(nombre),
        ingredientes: ingredientesDB,
        caloriasTotales: +totales.calorias.toFixed(2),
        macrosTotales: {
          proteinas: +totales.proteinas.toFixed(2),
          carbohidratos: +totales.carbohidratos.toFixed(2),
          grasas: +totales.grasas.toFixed(2),
        },
      },
      { new: true }
    );

    req.body.asesorId = req.user?._id; // para logMovimiento
    req.body.tipo = "EDITAR";
    await logMovimiento(req, `Combinación editada: ${combinacion.nombre} (ID: ${combinacion._id})`);
    res.json(combinacion);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/combinaciones/:id", async (req, res) => {
  try {
    await Combinacion.findByIdAndDelete(req.params.id);
    req.body.asesorId = req.user?._id; // para logMovimiento
    req.body.tipo = "BORRAR";
    await logMovimiento(req, `Combinación eliminada: ID ${req.params.id}`);
    res.json({ mensaje: "Combinación eliminada" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* =========================
   RECETAS (con anti-duplicados + freeSolo nombreLibre)
========================= */
// Crear receta (no duplica por nombre; acepta ingrediente por id o nombreLibre)
router.post("/recetas", async (req, res) => {
  try {
    const nombre = trim(req.body?.nombre || "");
    if (!nombre) return res.status(400).json({ error: "Nombre requerido" });

    // ¿Existe receta con el mismo nombre?
    const existe = await Receta.findOne({ nombre })
      .collation({ locale: "es", strength: 2 });
    if (existe) {
      return res.status(200).json({
        ...existe.toObject(),
        existing: true,
        message: "La receta ya existía; se ha reutilizado.",
      });
    }

    const rows = Array.isArray(req.body.ingredientes) ? req.body.ingredientes : [];
    const normalizados = [];

    // Totales (solo con ingredientes por id)
    let tot = { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };

    for (const row of rows) {
      const gramos = Number(row?.gramos || 0);
      if (!gramos || gramos < 0) continue;

      // ingrediente por id
      if (isId(row?.ingrediente)) {
        const ing = await Ingrediente.findById(row.ingrediente);
        if (ing) {
          const f = gramos / 100;
          tot.kcal += (ing.kcal || 0) * f;
          tot.proteinas += (ing.proteinas || 0) * f;
          tot.carbohidratos += (ing.carbohidratos || 0) * f;
          tot.grasas += (ing.grasas || 0) * f;

          normalizados.push({ ingrediente: ing._id, gramos });
          continue;
        }
      }

      // nombre libre (freeSolo)
      const nombreLibre = trim(row?.nombreLibre || "");
      if (nombreLibre) {
        normalizados.push({ nombreLibre, gramos });
      }
      // si no había ni id válido ni nombreLibre, se descarta la fila
    }

    const nueva = await Receta.create({
      nombre,
      linkPreparacion: trim(req.body.link || req.body.linkPreparacion || ""),
      ingredientes: normalizados,
      caloriasTotales: +tot.kcal.toFixed(2),
      macrosTotales: {
        proteinas: +tot.proteinas.toFixed(2),
        carbohidratos: +tot.carbohidratos.toFixed(2),
        grasas: +tot.grasas.toFixed(2),
      },
    });
    req.body.asesorId = req.user?._id; // para logMovimiento
    req.body.tipo = "CREAR"; // para logMovimiento
    await logMovimiento(req, `Receta creada: ${nueva.nombre} (ID: ${nueva._id})`);
    res.json(nueva);
  } catch (err) {
    if (err?.code === 11000) {
      const nombre = trim(req.body?.nombre || "");
      const existe = await Receta.findOne({ nombre })
        .collation({ locale: "es", strength: 2 });
      return res.status(200).json({
        ...existe.toObject(),
        existing: true,
        message: "La receta ya existía; se ha reutilizado.",
      });
    }
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

router.get("/recetas", async (req, res) => {
  try {
    const recetas = await Receta.find()
      .sort({ nombre: 1 })
      .populate("ingredientes.ingrediente")
      .lean();

    const recetasFormateadas = recetas.map((receta) => ({
      id: receta._id,
      nombre: receta.nombre,
      linkPreparacion: receta.linkPreparacion || "",
      caloriasTotales: receta.caloriasTotales,
      macrosTotales: receta.macrosTotales,
      ingredientes: (receta.ingredientes || []).map((i) => ({
        ingrediente: i.ingrediente?._id || null,
        nombre: i.ingrediente?.nombre || i.nombreLibre || "Desconocido",
        gramos: i.gramos,
      })),
    }));

    res.json(recetasFormateadas);
  } catch (error) {
    console.error("Error al obtener recetas:", error);
    res.status(500).json({ error: "Error al obtener recetas" });
  }
});

// Editar receta (evita renombrar a duplicado; re-normaliza si envían ingredientes)
router.put("/recetas/:id", async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.nombre) update.nombre = trim(update.nombre);

    if (update.nombre) {
      const dupe = await Receta.findOne({
        _id: { $ne: req.params.id },
        nombre: update.nombre,
      }).collation({ locale: "es", strength: 2 });
      if (dupe) return res.status(409).json({ error: "Ya existe una receta con ese nombre" });
    }

    // Si actualizan ingredientes, volvemos a normalizar y recalcular totales
    if (Array.isArray(update.ingredientes)) {
      const rows = update.ingredientes;
      const normalizados = [];
      let tot = { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };

      for (const row of rows) {
        const gramos = Number(row?.gramos || 0);
        if (!gramos || gramos < 0) continue;

        if (isId(row?.ingrediente)) {
          const ing = await Ingrediente.findById(row.ingrediente);
          if (ing) {
            const f = gramos / 100;
            tot.kcal += (ing.kcal || 0) * f;
            tot.proteinas += (ing.proteinas || 0) * f;
            tot.carbohidratos += (ing.carbohidratos || 0) * f;
            tot.grasas += (ing.grasas || 0) * f;

            normalizados.push({ ingrediente: ing._id, gramos });
            continue;
          }
        }

        const nombreLibre = trim(row?.nombreLibre || "");
        if (nombreLibre) {
          normalizados.push({ nombreLibre, gramos });
        }
      }

      update.ingredientes = normalizados;
      update.caloriasTotales = +tot.kcal.toFixed(2);
      update.macrosTotales = {
        proteinas: +tot.proteinas.toFixed(2),
        carbohidratos: +tot.carbohidratos.toFixed(2),
        grasas: +tot.grasas.toFixed(2),
      };
    }

    // linkPreparacion compat
    if (update.link !== undefined && update.linkPreparacion === undefined) {
      update.linkPreparacion = trim(update.link);
      delete update.link;
    }

    const receta = await Receta.findByIdAndUpdate(req.params.id, update, { new: true });
    req.body.asesorId = req.user?._id; // para logMovimiento
    req.body.tipo = "EDITAR";
    await logMovimiento(req, `Receta editada: ${receta.nombre} (ID: ${receta._id})`);
    res.json(receta);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Ya existe una receta con ese nombre" });
    }
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

router.delete("/recetas/:id", async (req, res) => {
  try {
    await Receta.findByIdAndDelete(req.params.id);
    req.body.asesorId = req.user?._id; // para logMovimiento
    req.body.tipo = "BORRAR";
    await logMovimiento(req, `Receta eliminada: ID ${req.params.id}`);
    res.json({ mensaje: "Receta eliminada" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
