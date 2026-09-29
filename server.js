require('dotenv').config();

const express = require('express');
const path = require('node:path');
const authConfigHandler = require('./api/auth/config');
const youtubePlaylistHandler = require('./api/youtube/playlist');

const host = '0.0.0.0';
const port = Number(process.env.PORT || 3000);
const app = express();

app.disable('x-powered-by');
app.use((request, response, next) => {
  response.set({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  });
  next();
});

function sendJson(response, status, body) {
  response.status(status).json(body);
}

app.get(['/', '/index.html'], (request, response) => {
  response.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/auth/config', authConfigHandler);

app.all('/api/youtube/playlist', youtubePlaylistHandler);

app.use((request, response) => {
  sendJson(response, 404, { error: 'Not found.' });
});

app.listen(port, host, () => {
  console.log(`Progress Tracker running at http://localhost:${port}`);
});