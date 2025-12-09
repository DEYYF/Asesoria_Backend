const mongoose = require('mongoose');
require('dotenv').config();

const Presupuesto = require('./models/Presuspuesto');
const Tarifa = require('./models/Tarifa');

async function recalcularPresupuestos() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conectado a MongoDB');

    const presupuestos = await Presupuesto.find().populate('tarifaId');
    console.log(`Encontrados ${presupuestos.length} presupuestos`);

    for (const p of presupuestos) {
      if (!p.tarifaId) {
        console.log(`Presupuesto ${p._id} no tiene tarifa, saltando...`);
        continue;
      }

      const duracionDias = p.tarifaId.duracionDias || 30;
      const meses = Math.ceil(duracionDias / 30);
      
      let subtotal = p.tarifaId.precio;
      
      // Actualizar extras con precioTotal
      const extrasActualizados = p.extras.map(e => {
        const precioMensual = e.precio;
        const precioTotal = precioMensual * meses;
        subtotal += precioTotal;
        return {
          extraId: e.extraId,
          precio: precioMensual,
          precioTotal: precioTotal
        };
      });

      // Recalcular total con descuento
      const descuentoValor = (subtotal * (p.descuento || 0)) / 100;
      const nuevoTotal = Math.max(0, subtotal - descuentoValor);

      console.log(`\nPresupuesto ${p._id}:`);
      console.log(`  Tarifa: ${p.tarifaId.precio}€ (${meses} meses)`);
      console.log(`  Extras: ${extrasActualizados.map(e => e.precioTotal).join(', ')}€`);
      console.log(`  Subtotal: ${subtotal}€`);
      console.log(`  Descuento: ${p.descuento}% = ${descuentoValor}€`);
      console.log(`  Total anterior: ${p.total}€`);
      console.log(`  Total nuevo: ${nuevoTotal}€`);

      // Actualizar presupuesto
      p.extras = extrasActualizados;
      p.total = nuevoTotal;
      await p.save();
      console.log(`  ✓ Actualizado`);
    }

    console.log('\n✓ Todos los presupuestos recalculados correctamente');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

recalcularPresupuestos();
