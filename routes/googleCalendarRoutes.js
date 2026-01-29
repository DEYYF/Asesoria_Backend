const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const Usuario = require('../models/Usuario');
const { oauth2Client, SCOPES } = require('../services/googleCalendarService');

// Start OAuth flow
router.get('/connect', auth, (req, res) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Usuario no identificado' });
  }

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: userId.toString()
  });
  res.json({ url });
});

// Callback
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  console.log('Google OAuth Callback received:', { state });
  
  if (!code || !state) {
    return res.status(400).send('Invalid request');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Tokens received from Google');
    
    const user = await Usuario.findById(state);
    if (!user) {
      console.error('User not found for state (ID):', state);
      return res.status(404).send('Usuario no encontrado');
    }
    console.log('User found for sync:', user.email);

    const oauth2 = require('googleapis').google.oauth2({ version: 'v2', auth: oauth2Client });
    oauth2Client.setCredentials(tokens);
    const userInfo = await oauth2.userinfo.get();
    console.log('User info from Google:', userInfo.data.email);

    user.googleCalendar = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      email: userInfo.data.email,
      isEnabled: true
    };

    await user.save();
    console.log('Google Calendar settings saved for user:', user.email);

    // Redirect back to frontend
    res.send('<html><body><h1>¡Conectado!</h1><p>Ya puedes cerrar esta ventana.</p><script>window.close();</script></body></html>');
  } catch (e) {
    console.error('Error en callback de Google:', e);
    // Provide a bit more info to the user for debugging
    res.status(500).send(`Error durante la conexión: ${e.message || 'Error desconocido'}`);
  }
});

// Disconnect
router.post('/disconnect', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await Usuario.findById(userId);
    if (user) {
      user.googleCalendar = { isEnabled: false };
      await user.save();
      console.log('Google Calendar disconnected for user:', user.email);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('Error disconnecting Google Calendar:', e);
    res.status(500).json({ error: e.message });
  }
});

// Status
router.get('/status', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    console.log('Checking Google Calendar status for user ID:', userId);
    
    const user = await Usuario.findById(userId).select('googleCalendar');
    if (!user) {
      console.error('User not found in status check:', userId);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const isConnected = !!user.googleCalendar?.accessToken;
    console.log('Status result:', { 
      email: user.googleCalendar?.email, 
      isConnected, 
      isEnabled: user.googleCalendar?.isEnabled 
    });

    res.json({
      isConnected: isConnected,
      email: user.googleCalendar?.email,
      isEnabled: user.googleCalendar?.isEnabled
    });
  } catch (e) {
    console.error('Error checking Google Calendar status:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
