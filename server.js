require('dotenv').config();

const express = require('express');
const path = require('node:path');
const { getSupabasePublicConfig } = require('./supabaseClient');

const host = '0.0.0.0';
const port = Number(process.env.PORT || 3000);
const apiBase = 'https://www.googleapis.com/youtube/v3/';
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

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(response, status, body) {
  response.status(status).json(body);
}

function youtubeError(payload, status) {
  const reason = payload?.error?.errors?.[0]?.reason || '';
  if (['keyInvalid', 'invalidKey'].includes(reason)) {
    return new HttpError(401, 'Invalid YouTube API key. Check YOUTUBE_API_KEY in .env.');
  }
  if (reason === 'accessNotConfigured') {
    return new HttpError(403, 'Enable YouTube Data API v3 for the Google Cloud project used by this key.');
  }
  if (['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded'].includes(reason)) {
    return new HttpError(429, 'YouTube API quota exceeded. Try again after the quota resets.');
  }
  if (['playlistNotFound', 'notFound'].includes(reason) || status === 404) {
    return new HttpError(404, 'Playlist not found. Check that the URL is correct and the playlist is public.');
  }
  if (status === 403) {
    return new HttpError(403, 'YouTube API access was denied. Check key restrictions and playlist visibility.');
  }
  return new HttpError(502, `YouTube API request failed (${status}). Check the API setup and try again.`);
}

async function youtubeRequest(endpoint, params, key) {
  const url = new URL(endpoint, apiBase);
  Object.entries({ ...params, key }).forEach(([name, value]) => url.searchParams.set(name, value));
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch (error) {
    const message = error.name === 'TimeoutError'
      ? 'YouTube API request timed out. Try again.'
      : 'Network failure while contacting YouTube. Check the server connection and try again.';
    throw new HttpError(502, message);
  }
  let payload;
  try { payload = await response.json(); } catch (error) { payload = {}; }
  if (!response.ok) throw youtubeError(payload, response.status);
  return payload;
}

function durationSeconds(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value || '');
  if (!match) return null;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

async function getPlaylist(playlistId, key) {
  const metadata = await youtubeRequest('playlists', { part: 'snippet', id: playlistId }, key);
  const title = metadata.items?.[0]?.snippet?.title;
  if (!title) throw new HttpError(404, 'Playlist not found or it is not public. Check the URL and playlist visibility.');

  const items = [];
  let pageToken = '';
  do {
    const params = { part: 'snippet,contentDetails', playlistId, maxResults: '50' };
    if (pageToken) params.pageToken = pageToken;
    const page = await youtubeRequest('playlistItems', params, key);
    items.push(...(page.items || []));
    pageToken = page.nextPageToken || '';
  } while (pageToken);

  if (!items.length) throw new HttpError(404, 'Playlist not found or it contains no public videos.');
  const available = items.filter(item => {
    const title = item.snippet?.title || '';
    return item.contentDetails?.videoId && !/^(private|deleted) video$/i.test(title);
  });
  const videos = [];
  for (let start = 0; start < available.length; start += 50) {
    const batch = available.slice(start, start + 50);
    const ids = batch.map(item => item.contentDetails.videoId);
    const result = await youtubeRequest('videos', { part: 'contentDetails,snippet', id: ids.join(',') }, key);
    const byId = new Map((result.items || []).map(video => [video.id, video]));
    batch.forEach(item => {
      const id = item.contentDetails.videoId;
      const video = byId.get(id);
      const sec = durationSeconds(video?.contentDetails?.duration);
      if (!video || sec === null) return;
      videos.push({ id, name: video.snippet?.title || item.snippet?.title || 'Untitled', sec });
    });
  }

  const inaccessible = items.length - videos.length;
  if (!videos.length) {
    throw new HttpError(404, 'No accessible videos found. The playlist may contain only private or deleted videos.');
  }
  return { title, videos, inaccessible };
}

app.get(['/', '/index.html'], (request, response) => {
  response.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/auth/config', (request, response) => {
  const config = getSupabasePublicConfig();
  if (!config) {
    sendJson(response, 503, { error: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.' });
    return;
  }
  sendJson(response, 200, config);
});

app.all('/api/youtube/playlist', async (request, response) => {
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }
  if (!process.env.YOUTUBE_API_KEY?.trim()) {
    sendJson(response, 503, { error: 'Missing API key. Add YOUTUBE_API_KEY to .env and restart the app.' });
    return;
  }
  const playlistId = typeof request.query.list === 'string' ? request.query.list : '';
  if (!/^[\w-]+$/.test(playlistId)) {
    sendJson(response, 400, { error: 'Invalid playlist ID.' });
    return;
  }
  try {
    sendJson(response, 200, await getPlaylist(playlistId, process.env.YOUTUBE_API_KEY.trim()));
  } catch (error) {
    sendJson(response, error.status || 500, { error: error.message || 'Unable to load the playlist.' });
  }
});

app.use((request, response) => {
  sendJson(response, 404, { error: 'Not found.' });
});

app.listen(port, host, () => {
  console.log(`Progress Tracker running at http://localhost:${port}`);
});