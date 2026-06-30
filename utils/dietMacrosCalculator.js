// utils/dietMacrosCalculator.js
const Ingrediente = require("../models/Ingredientes");
const Receta = require("../models/Recetas");

const zero = { kcal: 0, p: 0, c: 0, g: 0 };

function sumMacros(items) {
  return items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + (item?.kcal || 0),
      p: acc.p + (item?.p || 0),
      c: acc.c + (item?.c || 0),
      g: acc.g + (item?.g || 0),
    }),
    { ...zero }
  );
}

async function calculateIngredientMacros(item) {
  if (!item.ingredienteId || !item.gramos) return { ...zero };

  try {
    const ingrediente = await Ingrediente.findById(item.ingredienteId);

    if (!ingrediente) {
      console.warn(`Ingrediente not found: ${item.ingredienteId}`);
      return { ...zero };
    }

    if (!item.nombre) item.nombre = ingrediente.nombre;

    const factor = item.gramos / 100;

    return {
      kcal: Number(((ingrediente.kcal || 0) * factor).toFixed(2)),
      p: Number(((ingrediente.proteinas || 0) * factor).toFixed(2)),
      c: Number(((ingrediente.carbohidratos || 0) * factor).toFixed(2)),
      g: Number(((ingrediente.grasas || 0) * factor).toFixed(2)),
    };
  } catch (error) {
    console.error(`Error calculating macros for ingredient ${item.ingredienteId}:`, error);
    return { ...zero };
  }
}

async function calculateRecetaMacros(opcion) {
  if (!opcion.recetaId) return { ...zero };

  try {
    const receta = await Receta.findById(opcion.recetaId);

    if (!receta) {
      console.warn(`Receta not found: ${opcion.recetaId}`);
      return { ...zero };
    }

    if (!opcion.nombre) opcion.nombre = receta.nombre;

    return {
      kcal: Number((receta.caloriasTotales || 0).toFixed(2)),
      p: Number((receta.macrosTotales?.proteinas || 0).toFixed(2)),
      c: Number((receta.macrosTotales?.carbohidratos || 0).toFixed(2)),
      g: Number((receta.macrosTotales?.grasas || 0).toFixed(2)),
    };
  } catch (error) {
    console.error(`Error calculating macros for recipe ${opcion.recetaId}:`, error);
    return { ...zero };
  }
}

async function calculateOpcionMacros(opcion) {
  if (!opcion) return { ...zero };

  if (opcion.tipo === "combinacion" && Array.isArray(opcion.items)) {
    const itemsWithMacros = await Promise.all(
      opcion.items.map(async (item) => {
        const macros = await calculateIngredientMacros(item);
        return { ...item, macros };
      })
    );

    opcion.items = itemsWithMacros;

    return sumMacros(itemsWithMacros.map((item) => item.macros));
  }

  if (opcion.tipo === "receta") {
    return await calculateRecetaMacros(opcion);
  }

  if (opcion.tipo === "ingrediente") {
    return await calculateIngredientMacros(opcion);
  }

  return { ...zero };
}

async function calculateComidaMacros(comida) {
  if (!comida || !Array.isArray(comida.opciones) || comida.opciones.length === 0) {
    return { ...zero };
  }

  const opcionesWithMacros = await Promise.all(
    comida.opciones.map(async (opcion) => {
      const macros = await calculateOpcionMacros(opcion);
      opcion.macros = macros;
      return opcion;
    })
  );

  comida.opciones = opcionesWithMacros;

  const count = opcionesWithMacros.length;
  if (count === 0) return { ...zero };

  const total = sumMacros(opcionesWithMacros.map((opcion) => opcion.macros));

  return {
    kcal: Number((total.kcal / count).toFixed(2)),
    p: Number((total.p / count).toFixed(2)),
    c: Number((total.c / count).toFixed(2)),
    g: Number((total.g / count).toFixed(2)),
  };
}

async function calculateDiaCalendarioMacros(dia) {
  if (!dia || !Array.isArray(dia.comidas) || dia.comidas.length === 0) {
    dia.totales = { ...zero };
    return dia;
  }

  const comidasWithMacros = await Promise.all(
    dia.comidas.map(async (comida) => {
      const totales = await calculateComidaMacros(comida);
      comida.totales = totales;
      return comida;
    })
  );

  dia.comidas = comidasWithMacros;

  dia.totales = sumMacros(comidasWithMacros.map((comida) => comida.totales));

  return dia;
}

async function calculateDietMacros(dietaData) {
  if (!dietaData) return dietaData;

  if (dietaData.tipo === "calendario" && Array.isArray(dietaData.diasSemana)) {
    const diasWithMacros = await Promise.all(
      dietaData.diasSemana.map(async (dia) => calculateDiaCalendarioMacros(dia))
    );

    dietaData.diasSemana = diasWithMacros;

    const diasConComidas = diasWithMacros.filter(
      (dia) => Array.isArray(dia.comidas) && dia.comidas.length > 0
    );

    if (diasConComidas.length > 0) {
      const semanal = sumMacros(diasConComidas.map((dia) => dia.totales));

      dietaData.macros = {
        kcal: Number((semanal.kcal / diasConComidas.length).toFixed(2)),
        p: Number((semanal.p / diasConComidas.length).toFixed(2)),
        c: Number((semanal.c / diasConComidas.length).toFixed(2)),
        g: Number((semanal.g / diasConComidas.length).toFixed(2)),
      };
    }

    return dietaData;
  }

  if (!Array.isArray(dietaData.comidas) || dietaData.comidas.length === 0) {
    return dietaData;
  }

  const comidasWithMacros = await Promise.all(
    dietaData.comidas.map(async (comida) => {
      const totales = await calculateComidaMacros(comida);
      comida.totales = totales;
      return comida;
    })
  );

  dietaData.comidas = comidasWithMacros;
  dietaData.macros = sumMacros(comidasWithMacros.map((comida) => comida.totales));

  return dietaData;
}

module.exports = {
  calculateIngredientMacros,
  calculateRecetaMacros,
  calculateOpcionMacros,
  calculateComidaMacros,
  calculateDiaCalendarioMacros,
  calculateDietMacros,
};