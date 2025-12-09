const Cliente = require('../models/Cliente');
const Presupuesto = require('../models/Presuspuesto');

/**
 * Elimina un cliente y todos sus datos relacionados en cascada
 * @param {String} clienteId - ID del cliente a eliminar
 * @returns {Object} Resumen de elementos eliminados
 */
async function deleteClienteCascade(clienteId) {
  const resultado = {
    cliente: false,
    presupuestos: 0,
    dietas: 0,
    rutinas: 0,
    mediciones: 0,
  };

  try {
    // 1. Eliminar todos los presupuestos del cliente
    const presupuestosEliminados = await Presupuesto.deleteMany({ clienteId });
    resultado.presupuestos = presupuestosEliminados.deletedCount;

    // 2. Eliminar dietas (si existe el modelo)
    try {
      const Dieta = require('../models/Dieta');
      const dietasEliminadas = await Dieta.deleteMany({ clienteId });
      resultado.dietas = dietasEliminadas.deletedCount;
    } catch (err) {
      console.log('Modelo Dieta no encontrado o sin datos');
    }

    // 3. Eliminar entrenamientos (si existe el modelo)
    try {
      const Entrenamiento = require('../models/Entrenamiento');
      const entrenamientosEliminados = await Entrenamiento.deleteMany({ clienteId });
      resultado.rutinas = entrenamientosEliminados.deletedCount;
    } catch (err) {
      console.log('Modelo Entrenamiento no encontrado o sin datos');
    }

    // 4. Mediciones/Progreso están embebidos en el Cliente, no es necesario eliminar colección separada


    // 5. Finalmente, eliminar el cliente
    const clienteEliminado = await Cliente.findByIdAndDelete(clienteId);
    resultado.cliente = !!clienteEliminado;

    console.log('Cliente eliminado en cascada:', resultado);
    return resultado;
  } catch (error) {
    console.error('Error en deleteClienteCascade:', error);
    throw error;
  }
}

module.exports = { deleteClienteCascade };
