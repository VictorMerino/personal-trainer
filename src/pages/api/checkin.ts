import type { APIRoute } from 'astro';
import { DailyCheckInSchema } from '../../features/workout-generation/domain/readiness/daily-checkin.schema';
import { decideTrainingMode } from '../../features/workout-generation/domain/readiness/training-decision';
import { effectiveLimitationsForToday } from '../../features/workout-generation/domain/readiness/effective-limitations';
import { SupabaseCheckInRepository } from '../../features/workout-generation/infrastructure/supabase/supabase-checkin-repository';
import { SupabaseWorkoutRepository } from '../../features/workout-generation/infrastructure/supabase/supabase-workout-repository';
import { getActiveLimitations } from '../../features/workout-generation/infrastructure/supabase/supabase-limitations-query';
import { buildAndSaveActiveRecoveryPlan } from '../../features/workout-generation/infrastructure/build-and-save-recovery-plan';
import { requireUser } from './_shared/require-user';
import { jsonError, jsonOk } from './_shared/api-error';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireUser(request, { url: import.meta.env.SUPABASE_URL, anonKey: import.meta.env.SUPABASE_ANON_KEY });
  if (auth instanceof Response) return auth;
  const { userId, supabase } = auth;

  const body = await request.json().catch(() => null);
  const parsed = DailyCheckInSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'invalid-body', 'Check-in body failed validation.');
  const checkIn = parsed.data;

  const decision = decideTrainingMode(checkIn);
  const date = new Date().toISOString().slice(0, 10);

  const checkInRepository = new SupabaseCheckInRepository(supabase);
  const saved = await checkInRepository.saveCheckIn(userId, date, checkIn, decision);
  if (!saved.ok) return jsonError(500, 'save-failed', 'Could not save check-in.');

  if (decision.kind === 'ACTIVE_RECOVERY') {
    const workoutRepository = new SupabaseWorkoutRepository(supabase);
    const storedLimitations = await getActiveLimitations(supabase, userId);
    const effectiveLimitations = effectiveLimitationsForToday(storedLimitations, checkIn);
    const planResult = await buildAndSaveActiveRecoveryPlan(
      workoutRepository,
      userId,
      date,
      checkIn.equipmentContext,
      effectiveLimitations,
    );
    if (!planResult.ok) return jsonError(500, 'save-failed', 'Could not save active-recovery plan.');
  }

  return jsonOk({ decision, checkInId: saved.value.id });
};
