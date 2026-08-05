import type { APIRoute } from 'astro';
import { z } from 'zod';
import { StopReason } from '../../../../features/workout-generation/domain/session/stop-reason.schema';
import { SupabaseWorkoutRepository } from '../../../../features/workout-generation/infrastructure/supabase/supabase-workout-repository';
import { requireUser } from '../../_shared/require-user';
import { jsonError, jsonOk } from '../../_shared/api-error';
import { findPrescribedExercise } from '../_shared/find-prescribed-exercise';

export const prerender = false;

const INVALID_BODY = 'invalid-body';

const SkipExerciseBodySchema = z.object({
  exerciseId: z.string(),
  reason: StopReason.nullable().optional(),
});

export const POST: APIRoute = async ({ request, params }) => {
  const planId = params.id;
  if (!planId) return jsonError(400, INVALID_BODY, 'Missing workout plan id.');

  const auth = await requireUser(request, { url: import.meta.env.SUPABASE_URL, anonKey: import.meta.env.SUPABASE_ANON_KEY });
  if (auth instanceof Response) return auth;
  const { userId, supabase } = auth;

  const body = await request.json().catch(() => null);
  const parsedBody = SkipExerciseBodySchema.safeParse(body);
  if (!parsedBody.success) return jsonError(400, INVALID_BODY, 'Skip-exercise body failed validation.');

  const workoutRepository = new SupabaseWorkoutRepository(supabase);
  const stored = await workoutRepository.getPlan(userId, planId);
  if (!stored.ok) return jsonError(404, 'not-found', 'No workout plan with that id.');
  if (stored.value.endedAt) return jsonError(400, 'session-ended', 'This session has already ended.');

  if (!findPrescribedExercise(stored.value.plan, parsedBody.data.exerciseId)) {
    return jsonError(400, INVALID_BODY, 'No such exercise in this plan.');
  }

  const result = await workoutRepository.skipExercise(userId, planId, parsedBody.data.exerciseId, parsedBody.data.reason ?? null);
  if (!result.ok) return jsonError(500, 'save-failed', 'Could not record skipped exercise.');

  return jsonOk({ ok: true });
};
