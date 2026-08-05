import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// The anon key is safe to expose in the client bundle by design — RLS
// (docs/adr/0007-data-model-rls.md decision 3) is what actually protects
// data, not keeping this key secret.
let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    client = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.PUBLIC_SUPABASE_ANON_KEY);
  }
  return client;
}

export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await getSupabaseBrowserClient().auth.getSession();
  return session?.access_token ?? null;
}
