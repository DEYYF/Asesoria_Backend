const transcriptionService = require('../services/transcriptionService');
const fs = require('fs');

exports.transcribeAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo de audio.' });
    }

    const { path: filePath } = req.file;

    // Llamar al servicio de transcripción
    const text = await transcriptionService.transcribeAudio(filePath);

    // Eliminar el archivo temporal después de procesarlo
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error eliminando archivo temporal:', err);
    });

    res.status(200).json({ text });
  } catch (error) {
    console.error('Error en controlador de transcripción:', error);
    
    // Intentar eliminar el archivo si hubo error
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }

    if (error.code === 'insufficient_quota' || error.status === 429) {
      return res.status(429).json({ 
        error: 'Límite de transcripción alcanzado (OpenAI Quota). Por favor, contacta con soporte o intenta más tarde.',
        code: 'QUOTA_EXCEEDED'
      });
    }

    res.status(500).json({ error: 'Error al procesar la transcripción.' });
  }
};
