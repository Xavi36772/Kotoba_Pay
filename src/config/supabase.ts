import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Polyfill WebSocket for Node.js 20 (native WebSocket requires Node 22+)
const WebSocket = require('ws');
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}

let supabaseInstance: SupabaseClient | null = null;

export function initSupabase(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  supabaseInstance = createClient(supabaseUrl, supabaseKey, {
    realtime: { transport: WebSocket },
  });
  return supabaseInstance;
}

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    return initSupabase();
  }
  return supabaseInstance;
}
