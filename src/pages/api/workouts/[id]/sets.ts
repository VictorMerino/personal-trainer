import type { APIRoute } from 'astro';
import { z } from 'zod';
import { EXERCISE_CATALOG } from '../../../../features/workout-generation/domain/exercise/catalog';
import type { NewSetLog } from '../../../../features/workout-generation/domain/repository/workout-repository.port';
import { SupabaseWorkoutRepository } from '../../../../features/workout-generation/infrastructure/supabase/supabase-workout-repository';
import { requireUser } from '../../_shared/require-user';
import { jsonError, jsonOk } from '../../_shared/api-error';
import { findPrescribedExercise } from '../_shared/find-prescribed-exercise';

export const prerender = false;

const INVALID_BODY = 'invalid-body';

const LogSetBodySchema = z.object({
  exerciseId: z.string(),
  setIndex: z.number().int().nonnegative(),
  actualReps: z.number().int().positive().nullable().optional(),
  actualLoadKg: z.number().positive().nullable().optional(),
  actualSeconds: z.number().int().positive().nullable().optional(),
  actualRpe: z.number().min(0).max(10),
});

export const POST: APIRoute = async ({ request, params }) => {
  const planId = params.id;
  if (!planId) return jsonError(400, INVALID_BODY, 'Missing workout plan id.');

  const auth = await requireUser(request, { url: import.meta.env.SUPABASE_URL, anonKey: import.meta.env.SUPABASE_ANON_KEY });
  if (auth instanceof Response) return auth;
  const { userId, supabase } = auth;

  const body = await request.json().catch(() => null);
  const parsedBody = LogSetBodySchema.safeParse(body);
  if (!parsedBody.success) return jsonError(400, INVALID_BODY, 'Set log body failed validation.');

  const workoutRepository = new SupabaseWorkoutRepository(supabase);
  const stored = await workoutRepository.getPlan(userId, planId);
  if (!stored.ok) return jsonError(404, 'not-found', 'No workout plan with that id.');
  if (stored.value.endedAt) return jsonError(400, 'session-ended', 'This session has already ended.');

  const prescribed = findPrescribedExercise(stored.value.plan, parsedBody.data.exerciseId);
  const target = prescribed?.sets[parsedBody.data.setIndex];
  if (!prescribed || !target) return jsonError(400, INVALID_BODY, 'No prescribed set at that exercise/index.');

  // Only the field matching the prescribed set's kind may be set — an
  // 'reps' set logged with a loadKg (or vice versa) is a client bug, not a
  // valid correction (ADR-0002 decision 1's discriminated union carries
  // over to what can be logged against it).
  const { actualReps = null, actualLoadKg = null, actualSeconds = null } = parsedBody.data;
  const shapeValid =
    (target.kind === 'load' && actualReps !== null && actualLoadKg !== null && actualSeconds === null) ||
    (target.kind === 'reps' && actualReps !== null && actualLoadKg === null && actualSeconds === null) ||
    (target.kind === 'time' && actualSeconds !== null && actualReps === null && actualLoadKg === null);
  if (!shapeValid) return jsonError(400, INVALID_BODY, `Logged fields do not match the prescribed '${target.kind}' set.`);

  const exercise = EXERCISE_CATALOG.find((e) => e.id === parsedBody.data.exerciseId);
  if (!exercise) return jsonError(400, INVALID_BODY, 'Unknown exerciseId.');

  const log: NewSetLog = {
    exerciseId: parsedBody.data.exerciseId,
    movementPattern: exercise.pattern,
    setIndex: parsedBody.data.setIndex,
    actualReps,
    actualLoadKg,
    actualSeconds,
    actualRpe: parsedBody.data.actualRpe,
  };

  const result = await workoutRepository.logSet(userId, planId, log);
  if (!result.ok) return jsonError(500, 'save-failed', 'Could not save set log.');

  return jsonOk({ ok: true });
};
