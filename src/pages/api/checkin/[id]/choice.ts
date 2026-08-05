import type { APIRoute } from 'astro';
import { z } from 'zod';
import { effectiveLimitationsForToday } from '../../../../features/workout-generation/domain/readiness/effective-limitations';
import type { TrainingDecision } from '../../../../features/workout-generation/domain/readiness/training-decision';
import { SupabaseCheckInRepository } from '../../../../features/workout-generation/infrastructure/supabase/supabase-checkin-repository';
import { SupabaseWorkoutRepository } from '../../../../features/workout-generation/infrastructure/supabase/supabase-workout-repository';
import { getActiveLimitations } from '../../../../features/workout-generation/infrastructure/supabase/supabase-limitations-query';
import { buildAndSaveActiveRecoveryPlan, saveRestPlan } from '../../../../features/workout-generation/infrastructure/build-and-save-recovery-plan';
import { requireUser } from '../../_shared/require-user';
import { jsonError, jsonOk } from '../../_shared/api-error';

export const prerender = false;

const ChoiceBodySchema = z.object({ selection: z.enum(['ACTIVE_RECOVERY_WALK', 'REST']) });

export const POST: APIRoute = async ({ request, params }) => {
  const checkInId = params.id;
  if (!checkInId) return jsonError(400, 'invalid-body', 'Missing check-in id.');

  const auth = await requireUser(request, { url: import.meta.env.SUPABASE_URL, anonKey: import.meta.env.SUPABASE_ANON_KEY });
  if (auth instanceof Response) return auth;
  const { userId, supabase } = auth;

  const body = await request.json().catch(() => null);
  const parsedBody = ChoiceBodySchema.safeParse(body);
  if (!parsedBody.success) return jsonError(400, 'invalid-body', 'Choice body failed validation.');

  const checkInRepository = new SupabaseCheckInRepository(supabase);
  const existing = await checkInRepository.getCheckIn(userId, checkInId);
  // Same 404 (not 400) for "not a pending CHOICE" as for a nonexistent id —
  // both mean there is nothing here for this caller to resolve, and a
  // distinct status would let a caller probe which case they hit.
  if (!existing.ok || existing.value.decision.kind !== 'CHOICE') {
    return jsonError(404, 'not-found', 'No check-in with that id.');
  }

  const decision: TrainingDecision =
    parsedBody.data.selection === 'REST' ? { kind: 'REST' } : { kind: 'ACTIVE_RECOVERY', reason: 'choice-walk' };

  const resolved = await checkInRepository.resolveChoice(userId, checkInId, decision);
  if (!resolved.ok) return jsonError(500, 'save-failed', 'Could not resolve check-in.');

  const workoutRepository = new SupabaseWorkoutRepository(supabase);
  const planResult =
    decision.kind === 'REST'
      ? await saveRestPlan(workoutRepository, userId, existing.value.date)
      : await buildAndSaveActiveRecoveryPlan(
          workoutRepository,
          userId,
          existing.value.date,
          existing.value.checkIn.equipmentContext,
          effectiveLimitationsForToday(await getActiveLimitations(supabase, userId), existing.value.checkIn),
        );

  if (!planResult.ok) return jsonError(500, 'save-failed', 'Could not save plan.');

  return jsonOk({ decision: resolved.value.decision });
};
