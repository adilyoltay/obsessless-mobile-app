import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseTestClient(): SupabaseClient {
  const url = process.env.TEST_SUPABASE_URL as string;
  const serviceRole = process.env.TEST_SUPABASE_SERVICE_ROLE as string;
  if (!url || !serviceRole) {
    throw new Error('Missing TEST_SUPABASE_URL or TEST_SUPABASE_SERVICE_ROLE for live tests');
  }
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}


