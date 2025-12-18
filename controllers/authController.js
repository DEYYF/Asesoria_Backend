
const Usuario = require('../models/Usuario'); 
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    const usuarioExistente = await Usuario.findOne({ email });
    if (usuarioExistente) return res.status(400).json({ mensaje: 'El usuario ya existe' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = new Usuario({ nombre, email, password: hashedPassword });
    await nuevoUsuario.save();
    res.status(201).json({ mensaje: 'Usuario registrado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el registro' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await Usuario.findOne({ email });

    if (!user) {
        return res.status(400).json({ message: "Credenciales incorrectas falta user"});
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Credenciales incorrectas falta match" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.json({ message: "Login exitoso", token, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error en servidor" });
  }
};

exports.clientLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const Cliente = require('../models/Cliente');

    const cliente = await Cliente.findOne({ email });

    if (!cliente) {
      return res.status(400).json({ message: "Credenciales incorrectas" });
    }

    // Check if cliente has password set
    if (!cliente.password) {
      return res.status(400).json({ message: "Cuenta no configurada para login. Contacte al administrador." });
    }

    const isMatch = await bcrypt.compare(password, cliente.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Credenciales incorrectas" });
    }

    const token = jwt.sign(
      { id: cliente._id, type: 'client' },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // Return client data with userType flag
    const clienteData = cliente.toObject();
    delete clienteData.password; // Don't send password to frontend
    
    res.json({
      message: "Login exitoso",
      token,
      user: { ...clienteData, userType: 'client' }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error en servidor" });
  }
};
