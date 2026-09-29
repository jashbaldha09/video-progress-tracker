const { getSupabasePublicConfig } = require('../../supabaseClient');

module.exports = function authConfigHandler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }
  const config = getSupabasePublicConfig();
  if (!config) {
    sendJson(response, 503, { error: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.' });
    return;
  }
  sendJson(response, 200, config, request.method === 'HEAD');
};

function sendJson(response, status, body, headOnly = false) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(headOnly ? undefined : JSON.stringify(body));
}