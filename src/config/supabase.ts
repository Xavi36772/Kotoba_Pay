import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function initSupabase(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  supabaseInstance = createClient(supabaseUrl, supabaseKey);
  return supabaseInstance;
}

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    return initSupabase();
  }
  return supabaseInstance;
}
