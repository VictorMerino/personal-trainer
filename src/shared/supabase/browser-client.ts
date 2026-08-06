import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// The anon key is safe to expose in the client bundle by design — RLS
// (docs/adr/0007-data-model-rls.md decision 3) is what actually protects
// data, not keeping this key secret.
let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    const url = import.meta.env.PUBLIC_SUPABASE_URL;
    const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    // Fail with an actionable message instead of supabase-js's generic
    // "supabaseUrl is required" — this is a deployment/local-setup
    // misconfiguration (missing .env values), not a normal runtime state
    // any page should try to recover from.
    if (!url || !anonKey) {
      throw new Error('Supabase is not configured: set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in .env.');
    }
    client = createClient(url, anonKey);
  }
  return client;
}

export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await getSupabaseBrowserClient().auth.getSession();
  return session?.access_token ?? null;
}

// Every signed-in-only page repeats this exact redirect-if-not-authed
// check inline — centralized here so it's a single place to fix (like the
// unhandled rejection this used to cause: the inline `.then(...)` versions
// had no `.catch()`, so a config error surfaced as a raw stack trace
// instead of a message a user could read).
export async function requireSignedIn(): Promise<void> {
  try {
    const token = await getAccessToken();
    if (!token) window.location.href = '/login';
  } catch (err) {
    console.error('[auth] sign-in check failed', err);
    document.body.innerHTML = '<p role="alert">Something went wrong loading this page. Please try again later.</p>';
  }
}
