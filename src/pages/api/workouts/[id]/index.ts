import type { APIRoute } from 'astro';
import { SupabaseWorkoutRepository } from '../../../../features/workout-generation/infrastructure/supabase/supabase-workout-repository';
import { requireUser } from '../../_shared/require-user';
import { jsonError, jsonOk } from '../../_shared/api-error';

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
  const planId = params.id;
  if (!planId) return jsonError(400, 'invalid-body', 'Missing workout plan id.');

  const auth = await requireUser(request, { url: import.meta.env.SUPABASE_URL, anonKey: import.meta.env.SUPABASE_ANON_KEY });
  if (auth instanceof Response) return auth;
  const { userId, supabase } = auth;

  const workoutRepository = new SupabaseWorkoutRepository(supabase);
  const stored = await workoutRepository.getPlan(userId, planId);
  if (!stored.ok) return jsonError(404, 'not-found', 'No workout plan with that id.');

  return jsonOk({ id: stored.value.id, plan: stored.value.plan, endedAt: stored.value.endedAt });
};
