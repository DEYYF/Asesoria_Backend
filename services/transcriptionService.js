const fs = require('fs');
const OpenAI = require('openai');

class TranscriptionService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    if (this.apiKey) {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
      });
    } else {
      console.warn('⚠️ OPENAI_API_KEY no encontrada. TranscriptionService funcionará en modo SIMULACIÓN.');
    }
  }

  /**
   * Transcribe un archivo de audio a texto.
   * @param {string} filePath - Ruta absoluta del archivo de audio.
   * @returns {Promise<string>} - Texto transcrito.
   */
  async transcribeAudio(filePath) {
    if (!this.openai) {
      // Modo Simulación
      console.log('🔄 Simulando transcripción (Falta API Key)...');
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve("Esta es una transcripción simulada porque no se configuró la API Key de OpenAI. Para usar la transcripción real, añade OPENAI_API_KEY en el archivo .env.");
        }, 2000);
      });
    }

    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-1',
        language: 'es', // FORZAR ESPAÑOL (No traducción)
        response_format: 'json',
      });

      return transcription.text;
    } catch (error) {
      console.error('Error en TranscriptionService:', error);
      throw error;
    }
  }
}

module.exports = new TranscriptionService();
