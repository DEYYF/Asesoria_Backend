/**
 * Helper functions to check permissions based on tipoServicio
 */

const TIPO_SERVICIO = {
  DIETA: "Dieta",
  DIETA_ASESORAMIENTO: "Dieta y asesoramiento",
  RUTINA: "Rutina",
  RUTINA_ASESORAMIENTO: "Rutina y asesoramiento",
  DIETA_RUTINA: "Dieta y Rutina",
  MENSUAL: "Mensual",
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
};

/**
 * Check if client can view/edit diet based on their tipoServicio
 * @param {string} tipoServicio - Service type from cliente.tipoServicio
 * @returns {boolean}
 */
function canViewDiet(tipoServicio) {
  return [
    TIPO_SERVICIO.DIETA,
    TIPO_SERVICIO.DIETA_ASESORAMIENTO,
    TIPO_SERVICIO.DIETA_RUTINA,
    TIPO_SERVICIO.MENSUAL,
    TIPO_SERVICIO.TRIMESTRAL,
    TIPO_SERVICIO.SEMESTRAL,
    TIPO_SERVICIO.ANUAL,
  ].includes(tipoServicio);
}

/**
 * Check if client can view/edit training based on their tipoServicio
 * @param {string} tipoServicio - Service type from cliente.tipoServicio
 * @returns {boolean}
 */
function canViewTraining(tipoServicio) {
  return [
    TIPO_SERVICIO.RUTINA,
    TIPO_SERVICIO.RUTINA_ASESORAMIENTO,
    TIPO_SERVICIO.DIETA_RUTINA,
    TIPO_SERVICIO.MENSUAL,
    TIPO_SERVICIO.TRIMESTRAL,
    TIPO_SERVICIO.SEMESTRAL,
    TIPO_SERVICIO.ANUAL,
  ].includes(tipoServicio);
}

/**
 * Check if client can add progress based on their tipoServicio
 * @param {string} tipoServicio - Service type from cliente.tipoServicio
 * @returns {boolean}
 */
function canAddProgress(tipoServicio) {
  return [
    TIPO_SERVICIO.DIETA_ASESORAMIENTO,
    TIPO_SERVICIO.RUTINA_ASESORAMIENTO,
    TIPO_SERVICIO.MENSUAL,
    TIPO_SERVICIO.TRIMESTRAL,
    TIPO_SERVICIO.SEMESTRAL,
    TIPO_SERVICIO.ANUAL,
  ].includes(tipoServicio);
}

module.exports = {
  TIPO_SERVICIO,
  canViewDiet,
  canViewTraining,
  canAddProgress,
};
