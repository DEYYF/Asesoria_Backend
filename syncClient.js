// Quick fix script to sync client tipoServicio from budget
const mongoose = require('mongoose');
const Cliente = require('./models/Cliente');
const Presupuesto = require('./models/Presuspuesto');

async function syncClientFromBudget(clienteName) {
  try {
    await mongoose.connect('mongodb://localhost:27017/asesoria_app');
    
    // Find client
    const cliente = await Cliente.findOne({ nombre: clienteName });
    if (!cliente) {
      console.log(`Cliente "${clienteName}" not found`);
      process.exit(1);
    }
    
    console.log('Cliente found:', cliente.nombre);
    console.log('Current tipoServicio:', cliente.tipoServicio);
    
    // Find latest accepted/paid budget
    const presupuesto = await Presupuesto.findOne({ 
      clienteId: cliente._id,
      estado: { $in: ['aceptado', 'pagado'] }
    })
    .sort({ createdAt: -1 })
    .populate('tarifaId');
    
    if (!presupuesto) {
      console.log('No accepted/paid budget found');
      process.exit(1);
    }
    
    console.log('Budget found:', presupuesto._id);
    console.log('Tariff:', presupuesto.tarifaId.nombre);
    console.log('Tariff tipoServicio:', presupuesto.tarifaId.tipoServicio);
    
    // Sync client
    const diffTime = Math.abs(new Date(presupuesto.fechaFin) - new Date(presupuesto.fechaInicio));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    let tiempoTarifa = "1 Mes";
    if (diffDays > 360) tiempoTarifa = "12 Meses";
    else if (diffDays > 170) tiempoTarifa = "6 Meses";
    else if (diffDays > 80) tiempoTarifa = "3 Meses";
    
    const extrasIds = presupuesto.extras.map(e => e.extraId);
    
    await Cliente.findByIdAndUpdate(cliente._id, {
      Tarifa: presupuesto.tarifaId.nombre,
      Tiempo_Tarifa: tiempoTarifa,
      tipoServicio: presupuesto.tarifaId.tipoServicio,
      fechaInicio: presupuesto.fechaInicio,
      fechaFin: presupuesto.fechaFin,
      extras: extrasIds,
      presupuestoActivo: presupuesto._id,
      tarifaId: presupuesto.tarifaId._id,
    });
    
    console.log('\n✅ Cliente synced successfully!');
    console.log('New tipoServicio:', presupuesto.tarifaId.tipoServicio);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

// Get client name from command line
const clienteName = process.argv[2] || 'Unai';
syncClientFromBudget(clienteName);
