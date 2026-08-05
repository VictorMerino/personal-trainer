import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient, type SupabaseEnv } from '../../../features/workout-generation/infrastructure/supabase/supabase-client';
import { jsonError } from './api-error';

export interface AuthenticatedRequest {
  readonly userId: string;
  readonly supabase: SupabaseClient;
}

// Every route verifies the Supabase session server-side (ADR-0011 decision
// 5, PROJECT-BRIEF §9) — the client sends its access token as a bearer
// token, which doubles as the token the per-request Supabase client (and
// therefore RLS) is built on.
export async function requireUser(request: Request, env: SupabaseEnv): Promise<AuthenticatedRequest | Response> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) return jsonError(401, 'unauthenticated', 'No valid session.');

  const supabase = createSupabaseClient(env, token);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return jsonError(401, 'unauthenticated', 'No valid session.');

  return { userId: data.user.id, supabase };
}
