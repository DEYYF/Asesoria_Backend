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
        // Removed mandatory check to allow Global View

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const query = {
            tipoMovimiento: { $in: ['INGRESO', 'GASTO'] },
            fecha: { $gte: startOfMonth, $lte: endOfMonth }
        };
        if (asesorId) query.asesorId = asesorId;

        const movimientos = await Movimiento.find(query);

        let ingresosMensuales = 0;
        let gastosMensuales = 0;

        movimientos.forEach(m => {
            if (m.tipoMovimiento === 'INGRESO') ingresosMensuales += m.monto;
            if (m.tipoMovimiento === 'GASTO') gastosMensuales += m.monto;
        });

        // Totales históricos simplificados
        const histMatch = { tipoMovimiento: { $in: ['INGRESO', 'GASTO'] } };
        if (asesorId) histMatch.asesorId = new mongoose.Types.ObjectId(asesorId);

        const totalHistorico = await Movimiento.aggregate([
            { $match: histMatch },
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
        const query = { tipoMovimiento: { $in: ['INGRESO', 'GASTO'] } };
        if (asesorId) query.asesorId = asesorId;
        
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

exports.obtenerControlPagos = async (req, res) => {
    try {
        const { asesorId } = req.query;
        // Removed mandatory check to allow Global View

        const Cliente = require('../models/Cliente');
        const query = { estado: 'Activo' };
        if (asesorId) query.asesorId = asesorId;

        const clientes = await Cliente.find(query)
            .select('nombre email fechaFin presupuestoActivo')
            .populate('presupuestoActivo', 'estado total createdAt');

        const now = new Date();
        const results = clientes.map(c => {
            let status = 'PENDIENTE'; // Default if no active budget or not paid
            
            if (c.presupuestoActivo && c.presupuestoActivo.estado === 'pagado') {
                if (c.fechaFin && new Date(c.fechaFin) > now) {
                    status = 'AL_DIA';
                } else if (c.fechaFin) {
                    status = 'EXPIRADO';
                }
            } else if (c.presupuestoActivo && c.presupuestoActivo.estado === 'aceptado') {
                status = 'ESPERANDO_PAGO';
            }

            return {
                id: c._id,
                nombre: c.nombre,
                email: c.email,
                fechaFin: c.fechaFin,
                status,
                presupuestoId: c.presupuestoActivo ? c.presupuestoActivo._id : null
            };
        });

        res.json(results);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.obtenerHistoricoGrafico = async (req, res) => {
    try {
        const { asesorId } = req.query;
        // Removed mandatory check

        const monthsToFetch = 6;
        const result = [];
        const now = new Date();

        for (let i = monthsToFetch - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

            const matchQuery = {
                tipoMovimiento: { $in: ['INGRESO', 'GASTO'] },
                fecha: { $gte: startOfMonth, $lte: endOfMonth }
            };
            if (asesorId) matchQuery.asesorId = new mongoose.Types.ObjectId(asesorId);

            const movements = await Movimiento.aggregate([
                {
                    $match: matchQuery
                },
                {
                    $group: {
                        _id: '$tipoMovimiento',
                        total: { $sum: '$monto' }
                    }
                }
            ]);

            let ingresos = 0;
            let gastos = 0;
            movements.forEach(m => {
                if (m._id === 'INGRESO') ingresos = m.total;
                if (m._id === 'GASTO') gastos = m.total;
            });

            const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
            result.push({
                mes: monthNames[startOfMonth.getMonth()],
                ingresos,
                gastos,
                balance: ingresos - gastos
            });
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
