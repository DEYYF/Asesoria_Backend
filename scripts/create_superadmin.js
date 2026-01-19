
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const Usuario = require('../models/Usuario');

async function createSuperAdmin() {
  const email = 'admin@asesoria.com';
  const password = 'adminpassword123';
  const nombre = 'Super Admin';

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conectado a MongoDB...');

    const userExist = await Usuario.findOne({ email });

    if (userExist) {
      console.log(`El usuario ${email} ya existe. Promocionando a Super Admin...`);
      userExist.role = 'superadmin';
      await userExist.save();
      console.log('Usuario promocionado con éxito.');
    } else {
      console.log(`Creando nuevo Super Admin: ${email}...`);
      const hashedPassword = await bcrypt.hash(password, 10);
      const newAdmin = new Usuario({
        nombre,
        email,
        password: hashedPassword,
        role: 'superadmin'
      });
      await newAdmin.save();
      console.log('Super Admin creado con éxito.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB.');
  }
}

createSuperAdmin();
