// Helper function to calculate macros for diet items
const Ingrediente = require("../models/Ingredientes");
const Receta = require("../models/Recetas");

/**
 * Calculate macros for a single ingredient item based on grams
 * @param {Object} item - Item with ingredienteId and gramos
 * @returns {Object} Calculated macros {kcal, p, c, g}
 */
async function calculateIngredientMacros(item) {
  if (!item.ingredienteId || !item.gramos) {
    return { kcal: 0, p: 0, c: 0, g: 0 };
  }

  try {
    const ingrediente = await Ingrediente.findById(item.ingredienteId);
    if (!ingrediente) {
      console.warn(`Ingrediente not found: ${item.ingredienteId}`);
      return { kcal: 0, p: 0, c: 0, g: 0 };
    }

    // Populate name if missing
    if (!item.nombre) {
      item.nombre = ingrediente.nombre;
    }

    // Macros in DB are per 100g, calculate for actual grams
    const factor = item.gramos / 100;
    
    return {
      kcal: Number((ingrediente.kcal * factor).toFixed(2)),
      p: Number((ingrediente.proteinas * factor).toFixed(2)),
      c: Number((ingrediente.carbohidratos * factor).toFixed(2)),
      g: Number((ingrediente.grasas * factor).toFixed(2)),
    };
  } catch (error) {
    console.error(`Error calculating macros for ingredient ${item.ingredienteId}:`, error);
    return { kcal: 0, p: 0, c: 0, g: 0 };
  }
}

/**
 * Calculate macros for a recipe option
 * @param {Object} opcion - Option with recetaId
 * @returns {Object} Calculated macros {kcal, p, c, g}
 */
async function calculateRecetaMacros(opcion) {
  if (!opcion.recetaId) {
    return { kcal: 0, p: 0, c: 0, g: 0 };
  }

  try {
    const receta = await Receta.findById(opcion.recetaId);
    if (!receta) {
      console.warn(`Receta not found: ${opcion.recetaId}`);
      return { kcal: 0, p: 0, c: 0, g: 0 };
    }

    // Populate name if missing
    if (!opcion.nombre) {
      opcion.nombre = receta.nombre;
    }

    return {
      kcal: Number((receta.caloriasTotales || 0).toFixed(2)),
      p: Number((receta.macrosTotales?.proteinas || 0).toFixed(2)),
      c: Number((receta.macrosTotales?.carbohidratos || 0).toFixed(2)),
      g: Number((receta.macrosTotales?.grasas || 0).toFixed(2)),
    };
  } catch (error) {
    console.error(`Error calculating macros for recipe ${opcion.recetaId}:`, error);
    return { kcal: 0, p: 0, c: 0, g: 0 };
  }
}

/**
 * Calculate macros for an entire option (can be combinacion, receta, or ingrediente)
 * @param {Object} opcion - Option object with tipo and items/ingredientes
 * @returns {Object} Calculated macros {kcal, p, c, g}
 */
async function calculateOpcionMacros(opcion) {
  const zero = { kcal: 0, p: 0, c: 0, g: 0 };

  // Case 1: Combinacion (Array of ingredients)
  if (opcion.tipo === "combinacion" && Array.isArray(opcion.items)) {
    // Calculate macros for each item and sum them
    const itemsWithMacros = await Promise.all(
      opcion.items.map(async (item) => {
        const macros = await calculateIngredientMacros(item);
        return { ...item, macros };
      })
    );

    // Update items with calculated macros
    opcion.items = itemsWithMacros;

    // Sum all item macros for option total
    const total = itemsWithMacros.reduce((acc, item) => ({
      kcal: acc.kcal + (item.macros?.kcal || 0),
      p: acc.p + (item.macros?.p || 0),
      c: acc.c + (item.macros?.c || 0),
      g: acc.g + (item.macros?.g || 0),
    }), { ...zero });

    return total;
  }

  // Case 2: Receta
  if (opcion.tipo === "receta") {
    return await calculateRecetaMacros(opcion);
  }

  // Case 3: Single Ingrediente (as a top-level option)
  if (opcion.tipo === "ingrediente") {
    return await calculateIngredientMacros(opcion);
  }

  return zero;
}

/**
 * Calculate macros for an entire comida (meal)
 * @param {Object} comida - Comida object with opciones array
 * @returns {Object} Calculated totals {kcal, p, c, g}
 */
async function calculateComidaMacros(comida) {
  const zero = { kcal: 0, p: 0, c: 0, g: 0 };

  if (!Array.isArray(comida.opciones) || comida.opciones.length === 0) {
    return zero;
  }

  // Calculate macros for each option
  const opcionesWithMacros = await Promise.all(
    comida.opciones.map(async (opcion) => {
      const macros = await calculateOpcionMacros(opcion);
      opcion.macros = macros;
      return opcion;
    })
  );

  comida.opciones = opcionesWithMacros;

  // Calculate average of all option macros for comida total
  // If options represent alternatives, the meal value is the average of them
  const count = opcionesWithMacros.length;
  if (count === 0) return zero;

  const sum = opcionesWithMacros.reduce((acc, opcion) => ({
    kcal: acc.kcal + (opcion.macros?.kcal || 0),
    p: acc.p + (opcion.macros?.p || 0),
    c: acc.c + (opcion.macros?.c || 0),
    g: acc.g + (opcion.macros?.g || 0),
  }), { ...zero });

  return {
    kcal: Number((sum.kcal / count).toFixed(2)),
    p: Number((sum.p / count).toFixed(2)),
    c: Number((sum.c / count).toFixed(2)),
    g: Number((sum.g / count).toFixed(2)),
  };
}

/**
 * Calculate macros for entire diet
 * @param {Object} dietaData - Diet data with comidas array
 * @returns {Object} Updated diet data with calculated macros
 */
async function calculateDietMacros(dietaData) {
  if (dietaData.tipoPlan === "calendario" && Array.isArray(dietaData.diasCalendario)) {
    const calculatedDays = await Promise.all(
      dietaData.diasCalendario.map(async (dia) => {
        if (Array.isArray(dia.comidas)) {
          const comidasWithMacros = await Promise.all(
            dia.comidas.map(async (comida) => {
              const totales = await calculateComidaMacros(comida);
              comida.totales = totales;
              return comida;
            })
          );
          dia.comidas = comidasWithMacros;

          // Day total is the sum of its comidas
          dia.totales = comidasWithMacros.reduce((acc, comida) => ({
            kcal: acc.kcal + (comida.totales?.kcal || 0),
            p: acc.p + (comida.totales?.p || 0),
            c: acc.c + (comida.totales?.c || 0),
            g: acc.g + (comida.totales?.g || 0),
          }), { kcal: 0, p: 0, c: 0, g: 0 });
        } else {
          dia.totales = { kcal: 0, p: 0, c: 0, g: 0 };
        }
        return dia;
      })
    );
    dietaData.diasCalendario = calculatedDays;

    // Average across all days for diet-level macros
    const count = calculatedDays.length;
    if (count > 0) {
      const sum = calculatedDays.reduce((acc, dia) => ({
        kcal: acc.kcal + (dia.totales?.kcal || 0),
        p: acc.p + (dia.totales?.p || 0),
        c: acc.c + (dia.totales?.c || 0),
        g: acc.g + (dia.totales?.g || 0),
      }), { kcal: 0, p: 0, c: 0, g: 0 });

      dietaData.macros = {
        kcal: Number((sum.kcal / count).toFixed(2)),
        p: Number((sum.p / count).toFixed(2)),
        c: Number((sum.c / count).toFixed(2)),
        g: Number((sum.g / count).toFixed(2)),
      };
    } else {
      dietaData.macros = { kcal: 0, p: 0, c: 0, g: 0 };
    }

    return dietaData;
  }

  if (!Array.isArray(dietaData.comidas) || dietaData.comidas.length === 0) {
    return dietaData;
  }

  // Calculate macros for each comida
  const comidasWithMacros = await Promise.all(
    dietaData.comidas.map(async (comida) => {
      const totales = await calculateComidaMacros(comida);
      comida.totales = totales;
      return comida;
    })
  );

  dietaData.comidas = comidasWithMacros;

  // Calculate diet-level macros (sum of all comidas)
  const dietMacros = comidasWithMacros.reduce((acc, comida) => ({
    kcal: acc.kcal + (comida.totales?.kcal || 0),
    p: acc.p + (comida.totales?.p || 0),
    c: acc.c + (comida.totales?.c || 0),
    g: acc.g + (comida.totales?.g || 0),
  }), { kcal: 0, p: 0, c: 0, g: 0 });

  dietaData.macros = dietMacros;

  return dietaData;
}

module.exports = {
  calculateIngredientMacros,
  calculateRecetaMacros,
  calculateOpcionMacros,
  calculateComidaMacros,
  calculateDietMacros,
};
