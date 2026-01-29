const { google } = require('googleapis');
const Usuario = require('../models/Usuario');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

/**
 * Validates and refreshes tokens if necessary
 */
const getAuthClient = async (user) => {
  if (!user.googleCalendar?.accessToken) {
    throw new Error('Google Calendar no está conectado');
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  client.setCredentials({
    access_token: user.googleCalendar.accessToken,
    refresh_token: user.googleCalendar.refreshToken,
    expiry_date: user.googleCalendar.expiryDate,
  });

  // Check if expired
  if (user.googleCalendar.expiryDate <= Date.now()) {
    try {
      const { credentials } = await client.refreshAccessToken();
      user.googleCalendar.accessToken = credentials.access_token;
      user.googleCalendar.expiryDate = credentials.expiry_date;
      if (credentials.refresh_token) {
        user.googleCalendar.refreshToken = credentials.refresh_token;
      }
      await user.save();
      client.setCredentials(credentials);
    } catch (e) {
      console.error('Error refreshing Google token:', e);
      throw new Error('Error al refrescar el token de Google');
    }
  }

  return client;
};

/**
 * Syncs a Cita to Google Calendar
 */
const syncToGoogle = async (user, cita) => {
  if (!user.googleCalendar?.isEnabled) return;

  try {
    const auth = await getAuthClient(user);
    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
      summary: cita.title,
      description: cita.notas || '',
      start: {
        dateTime: `${cita.date}T${cita.hora || '00:00'}:00`,
        timeZone: 'Europe/Madrid', // Should ideally be dynamic
      },
      end: {
        dateTime: `${cita.date}T${cita.horaFin || cita.hora || '00:00'}:00`,
        timeZone: 'Europe/Madrid',
      },
    };

    if (cita.googleEventId) {
      // Update existing
      await calendar.events.update({
        calendarId: 'primary',
        eventId: cita.googleEventId,
        resource: event,
      });
    } else {
      // Create new
      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });
      cita.googleEventId = response.data.id;
      await cita.save();
    }
  } catch (e) {
    console.error('Error syncing to Google Calendar:', e);
  }
};

/**
 * Deletes a Google Calendar event
 */
const deleteFromGoogle = async (user, googleEventId) => {
  if (!user.googleCalendar?.isEnabled || !googleEventId) return;

  try {
    const auth = await getAuthClient(user);
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: googleEventId,
    });
  } catch (e) {
    console.error('Error deleting Google Calendar event:', e);
  }
};

module.exports = {
  oauth2Client,
  SCOPES,
  syncToGoogle,
  deleteFromGoogle,
  getAuthClient
};
