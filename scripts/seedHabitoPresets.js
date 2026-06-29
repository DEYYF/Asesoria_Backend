const mongoose = require('mongoose');
const HabitoPreset = require('../models/HabitoPreset');
require('dotenv').config();

const presets = [
  {
    nombre: 'Beber Agua',
    descripcion: 'Mantente hidratado durante el día',
    tipo: 'numeric',
    unidad: 'L',
    target: 2,
    categoria: 'salud',
    icono: 'water_drop',
    orden: 1
  },
  {
    nombre: 'Pasos Diarios',
    descripcion: 'Camina al menos 10,000 pasos al día',
    tipo: 'numeric',
    unidad: 'pasos',
    target: 10000,
    categoria: 'fitness',
    icono: 'directions_walk',
    orden: 2
  },
  {
    nombre: 'Meditación',
    descripcion: 'Dedica tiempo a la meditación y mindfulness',
    tipo: 'checklist',
    categoria: 'bienestar',
    icono: 'self_improvement',
    orden: 3
  },
  {
    nombre: 'Lectura',
    descripcion: 'Lee al menos 10 minutos al día',
    tipo: 'checklist',
    categoria: 'productividad',
    icono: 'menu_book',
    orden: 4
  },
  {
    nombre: 'Ducha Fría',
    descripcion: 'Termina tu ducha con agua fría para activar tu cuerpo',
    tipo: 'checklist',
    categoria: 'bienestar',
    icono: 'ac_unit',
    orden: 5
  },
  {
    nombre: 'Dormir 8 Horas',
    descripcion: 'Registra tus horas de sueño',
    tipo: 'numeric',
    unidad: 'horas',
    target: 8,
    categoria: 'salud',
    icono: 'bedtime',
    orden: 6
  },
  {
    nombre: 'Frutas y Verduras',
    descripcion: 'Consume al menos 5 porciones al día',
    tipo: 'numeric',
    unidad: 'porciones',
    target: 5,
    categoria: 'nutricion',
    icono: 'eco',
    orden: 7
  },
  {
    nombre: 'Entrenamiento',
    descripcion: 'Realiza ejercicio físico',
    tipo: 'checklist',
    categoria: 'fitness',
    icono: 'fitness_center',
    orden: 8
  },
  {
    nombre: 'Gratitud',
    descripcion: 'Escribe 3 cosas por las que estás agradecido',
    tipo: 'checklist',
    categoria: 'bienestar',
    icono: 'favorite',
    orden: 9
  },
  {
    nombre: 'Sin Redes Sociales',
    descripcion: 'Evita las redes sociales durante el día',
    tipo: 'checklist',
    categoria: 'productividad',
    icono: 'phone_disabled',
    orden: 10
  }
];

async function seedPresets() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/asesoria_app');
    console.log('✅ MongoDB connected');

    // Clear existing presets
    await HabitoPreset.deleteMany({});
    console.log('🗑️  Cleared existing presets');

    // Insert new presets
    await HabitoPreset.insertMany(presets);
    console.log(`✅ Inserted ${presets.length} habit presets`);

    mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (err) {
    console.error('❌ Error seeding presets:', err);
    process.exit(1);
  }
}

seedPresets();
