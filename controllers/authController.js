
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

    const token = jwt.sign({ id: user._id, role: user.role || 'advisor' }, process.env.JWT_SECRET, {
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
    const { email, password, isFirstLogin } = req.body;
    const Cliente = require('../models/Cliente');

    // Validate email is provided
    if (!email) {
      return res.status(400).json({ message: "Email requerido" });
    }

    const cliente = await Cliente.findOne({ email });

    if (!cliente) {
      return res.status(400).json({ message: "Credenciales incorrectas" });
    }

    // Check if cliente has password set - FIRST CHECK
    if (!cliente.password) {
      // If isFirstLogin is true and password provided, set it up
      if (isFirstLogin && password && password.length >= 6) {
        const hashedPassword = await bcrypt.hash(password, 10);
        cliente.password = hashedPassword;
        await cliente.save();

        const token = jwt.sign(
          { id: cliente._id, role: 'client', type: 'client' },
          process.env.JWT_SECRET,
          { expiresIn: "30d" }
        );

        const clienteData = cliente.toObject();
        delete clienteData.password;
        
        return res.json({
          message: "Contraseña establecida exitosamente",
          token,
          user: { ...clienteData, userType: 'client' }
        });
      }
      
      // No password set and not setting one - require password setup
      // Return 200 (not 400) so frontend can handle it
      return res.status(200).json({ 
        requiresPasswordSetup: true,
        clienteId: cliente._id,
        message: "Primera vez. Establece tu contraseña." 
      });
    }

    // Cliente has password - verify it
    if (!password) {
      return res.status(400).json({ message: "Contraseña requerida" });
    }

    const isMatch = await bcrypt.compare(password, cliente.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Credenciales incorrectas" });
    }

    const token = jwt.sign(
      { id: cliente._id, role: 'client', type: 'client' },
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

exports.checkClientStatus = async (req, res) => {
  try {
    const { email } = req.body;
    const Cliente = require('../models/Cliente');

    if (!email) {
      return res.status(400).json({ message: "Email requerido" });
    }

    const cliente = await Cliente.findOne({ email });

    if (!cliente) {
      return res.status(404).json({ exists: false, message: "Cliente no encontrado" });
    }

    return res.json({
      exists: true,
      requiresPasswordSetup: !cliente.password,
      message: cliente.password ? "Cliente requiere contraseña" : "Cliente requiere configuración de contraseña"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error en servidor" });
  }
};
