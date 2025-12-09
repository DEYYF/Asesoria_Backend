const { canViewDiet, canViewTraining, canAddProgress } = require("../utils/permissionsHelper");
const Cliente = require("../models/Cliente");

/**
 * Middleware to check if client can access diet-related routes
 */
async function checkDietPermission(req, res, next) {
  try {
    const clienteId = req.params.id || req.params.clienteId;
    
    if (!clienteId) {
      return res.status(400).json({ error: "Cliente ID requerido" });
    }

    const cliente = await Cliente.findById(clienteId);
    
    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    if (!canViewDiet(cliente.tipoServicio)) {
      return res.status(403).json({ 
        error: "El tipo de servicio del cliente no incluye acceso a dietas",
        tipoServicio: cliente.tipoServicio 
      });
    }

    // Store cliente in request for later use
    req.cliente = cliente;
    next();
  } catch (error) {
    console.error("Error in checkDietPermission:", error);
    res.status(500).json({ error: "Error verificando permisos" });
  }
}

/**
 * Middleware to check if client can access training-related routes
 */
async function checkTrainingPermission(req, res, next) {
  try {
    const clienteId = req.params.id || req.params.clienteId;
    
    if (!clienteId) {
      return res.status(400).json({ error: "Cliente ID requerido" });
    }

    const cliente = await Cliente.findById(clienteId);
    
    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    if (!canViewTraining(cliente.tipoServicio)) {
      return res.status(403).json({ 
        error: "El tipo de servicio del cliente no incluye acceso a entrenamiento",
        tipoServicio: cliente.tipoServicio 
      });
    }

    // Store cliente in request for later use
    req.cliente = cliente;
    next();
  } catch (error) {
    console.error("Error in checkTrainingPermission:", error);
    res.status(500).json({ error: "Error verificando permisos" });
  }
}

/**
 * Middleware to check if client can add progress
 */
async function checkProgressPermission(req, res, next) {
  try {
    const clienteId = req.params.id || req.params.clienteId;
    
    if (!clienteId) {
      return res.status(400).json({ error: "Cliente ID requerido" });
    }

    const cliente = await Cliente.findById(clienteId);
    
    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    if (!canAddProgress(cliente.tipoServicio)) {
      return res.status(403).json({ 
        error: "El tipo de servicio del cliente no incluye seguimiento de progreso",
        tipoServicio: cliente.tipoServicio 
      });
    }

    // Store cliente in request for later use
    req.cliente = cliente;
    next();
  } catch (error) {
    console.error("Error in checkProgressPermission:", error);
    res.status(500).json({ error: "Error verificando permisos" });
  }
}

module.exports = {
  checkDietPermission,
  checkTrainingPermission,
  checkProgressPermission,
};
