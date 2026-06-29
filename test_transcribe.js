const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testTranscribe() {
  const url = 'http://localhost:5000/api/transcribe';
  const form = new FormData();
  
  // Usamos un archivo de prueba si existe, o creamos un buffer dummy
  // En este caso, para probar el fileFilter de Multer sin un audio real,
  // podemos enviar cualquier cosa con la extensión .m4a
  const dummyAudio = Buffer.from('dummy audio content');
  
  form.append('audio', dummyAudio, {
    filename: 'test_recording.m4a',
    contentType: 'application/octet-stream', // Simulamos el fallo del frontend
  });

  try {
    console.log('Enviando petición a', url);
    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        // Añade un token si es necesario, pero para esta prueba local
        // el log del backend nos dirá si pasó el fileFilter
      },
    });
    console.log('Respuesta:', response.data);
  } catch (error) {
    if (error.response) {
      console.error('Error del servidor:', error.response.status, error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testTranscribe();
