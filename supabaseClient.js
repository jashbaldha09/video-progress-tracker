const { createClient } = require('@supabase/supabase-js');

let supabaseClient;

function getSupabasePublicConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env before using Supabase.');
  }

  supabaseClient = createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
  return supabaseClient;
}

module.exports = { getSupabaseClient, getSupabasePublicConfig };