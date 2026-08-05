import type { APIRoute } from 'astro';
import { z } from 'zod';
import { StopReason } from '../../../../features/workout-generation/domain/session/stop-reason.schema';
import { SupabaseWorkoutRepository } from '../../../../features/workout-generation/infrastructure/supabase/supabase-workout-repository';
import { requireUser } from '../../_shared/require-user';
import { jsonError, jsonOk } from '../../_shared/api-error';

export const prerender = false;

const EndSessionBodySchema = z.object({ reason: StopReason.nullable().optional() });

export const POST: APIRoute = async ({ request, params }) => {
  const planId = params.id;
  if (!planId) return jsonError(400, 'invalid-body', 'Missing workout plan id.');

  const auth = await requireUser(request, { url: import.meta.env.SUPABASE_URL, anonKey: import.meta.env.SUPABASE_ANON_KEY });
  if (auth instanceof Response) return auth;
  const { userId, supabase } = auth;

  const body = await request.json().catch(() => ({}));
  const parsedBody = EndSessionBodySchema.safeParse(body);
  if (!parsedBody.success) return jsonError(400, 'invalid-body', 'End-session body failed validation.');

  const workoutRepository = new SupabaseWorkoutRepository(supabase);
  const stored = await workoutRepository.getPlan(userId, planId);
  if (!stored.ok) return jsonError(404, 'not-found', 'No workout plan with that id.');
  if (stored.value.endedAt) return jsonError(400, 'already-ended', 'This session has already ended.');

  const result = await workoutRepository.endSession(userId, planId, parsedBody.data.reason ?? null);
  if (!result.ok) return jsonError(500, 'save-failed', 'Could not end session.');

  return jsonOk({ ok: true, endedAt: result.value.endedAt });
};
