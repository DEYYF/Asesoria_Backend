const express = require('express');
const router = express.Router();
const transcriptionController = require('../controllers/transcriptionController');
const multer = require('multer');
const path = require('path');

// Configuración de Multer para archivos temporales
const upload = multer({
  dest: 'uploads/temp/', // Asegúrate de que esta carpeta exista o se cree
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB (límite de Whisper)
  fileFilter: (req, file, cb) => {
    // Aceptar si es audio/* o si tiene una extensión de audio común (por si falla la detección de MIME)
    const allowedExtensions = ['.m4a', '.mp3', '.wav', '.ogg', '.aac'];
    const extension = path.extname(file.originalname).toLowerCase();
    
    console.log(`[Multer] Recibido archivo: ${file.originalname}, MIME: ${file.mimetype}`);

    if (file.mimetype.startsWith('audio/') || allowedExtensions.includes(extension)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de audio.'), false);
    }
  },
});

// Ruta POST /api/transcribe
router.post(
  '/',
  upload.single('audio'), // 'audio' es el nombre del campo en el form-data
  transcriptionController.transcribeAudio
);

module.exports = router;
