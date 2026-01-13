const Movimiento = require('../models/Movimiento');
const mongoose = require('mongoose');
const { z } = require('zod');

const movimientoSchema = z.object({
    asesorId: z.string().min(1, 'asesorId es requerido'),
    descripcion: z.string().min(1, 'La descripción es requerida').max(100),
    monto: z.number().positive('El monto debe ser un número positivo'),
    tipoMovimiento: z.enum(['INGRESO', 'GASTO']),
    categoria: z.string().default('General'),
    fecha: z.string().optional()
});

exports.obtenerResumen = async (req, res) => {
    try {
        const { asesorId } = req.query;
        if (!asesorId) return res.status(400).json({ message: 'asesorId es requerido' });

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const movimientos = await Movimiento.find({
            asesorId,
            tipoMovimiento: { $in: ['INGRESO', 'GASTO'] },
            fecha: { $gte: startOfMonth, $lte: endOfMonth }
        });

        let ingresosMensuales = 0;
        let gastosMensuales = 0;

        movimientos.forEach(m => {
            if (m.tipoMovimiento === 'INGRESO') ingresosMensuales += m.monto;
            if (m.tipoMovimiento === 'GASTO') gastosMensuales += m.monto;
        });

        // Totales históricos simplificados (opcional)
        const totalHistorico = await Movimiento.aggregate([
            { $match: { asesorId: new mongoose.Types.ObjectId(asesorId), tipoMovimiento: { $in: ['INGRESO', 'GASTO'] } } },
            { $group: { _id: '$tipoMovimiento', total: { $sum: '$monto' } } }
        ]);

        let ingresosTotales = 0;
        let gastosTotales = 0;
        totalHistorico.forEach(item => {
            if (item._id === 'INGRESO') ingresosTotales = item.total;
            if (item._id === 'GASTO') gastosTotales = item.total;
        });

        res.json({
            mesActual: {
                ingresos: ingresosMensuales,
                gastos: gastosMensuales,
                balance: ingresosMensuales - gastosMensuales
            },
            historico: {
                ingresos: ingresosTotales,
                gastos: gastosTotales,
                balance: ingresosTotales - gastosTotales
            }
        });
    } catch (error) {
        console.error('Error en obtenerResumen:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.obtenerMovimientos = async (req, res) => {
    try {
        const { asesorId, limit = 50, skip = 0, tipo } = req.query;
        const query = { asesorId, tipoMovimiento: { $in: ['INGRESO', 'GASTO'] } };
        
        if (tipo) query.tipoMovimiento = tipo;

        const movimientos = await Movimiento.find(query)
            .sort({ fecha: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .populate('clienteId', 'nombre email')
            .populate('presupuestoId', 'total estado');

        res.json(movimientos);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.crearMovimientoManual = async (req, res) => {
    try {
        const validatedData = movimientoSchema.parse(req.body);
        
        const nuevoMovimiento = new Movimiento({
            ...validatedData,
            fecha: validatedData.fecha || Date.now(),
            Tipo: 'FINANZAS'
        });

        await nuevoMovimiento.save();
        res.status(201).json(nuevoMovimiento);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ 
                message: 'Error de validación', 
                errors: error.errors.map(e => e.message) 
            });
        }
        res.status(500).json({ message: error.message });
    }
};

exports.eliminarMovimiento = async (req, res) => {
    try {
        await Movimiento.findByIdAndDelete(req.params.id);
        res.json({ message: 'Movimiento eliminado' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
