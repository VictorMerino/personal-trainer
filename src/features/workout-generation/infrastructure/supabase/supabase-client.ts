import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseEnv {
  readonly url: string;
  readonly anonKey: string;
}

// RLS resolves auth.uid() from the request's JWT (ADR-0007 decision 3), so
// every client must carry the calling user's access token — there is no
// single shared client that works for all users.
export function createSupabaseClient(env: SupabaseEnv, accessToken: string): SupabaseClient {
  return createClient(env.url, env.anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
