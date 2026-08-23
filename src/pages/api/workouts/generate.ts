import type { APIRoute } from 'astro';
import { EXERCISE_CATALOG } from '../../../features/workout-generation/domain/exercise/catalog';
import { DAILY_GENERATION_LIMIT, DEMO_DAILY_GENERATION_LIMIT } from '../../../features/workout-generation/domain/generator/generator.constants';
import { buildHistorySummary, RECENT_HISTORY_WINDOW_DAYS } from '../../../features/workout-generation/domain/history/history-summary';
import { FallbackChainPlanner } from '../../../features/workout-generation/domain/planner/fallback-chain-planner';
import { DeterministicPlanner } from '../../../features/workout-generation/domain/planner/deterministic-planner';
import { NoPlannerAvailableError } from '../../../features/workout-generation/domain/planner/no-planner-available.error';
import type { PlanRequest } from '../../../features/workout-generation/domain/planner/workout-planner.port';
import { effectiveLimitationsForToday } from '../../../features/workout-generation/domain/readiness/effective-limitations';
import { createWorkoutPlanner } from '../../../features/workout-generation/infrastructure/create-workout-planner';
import { ConsolePlannerTelemetry } from '../../../features/workout-generation/infrastructure/planner-telemetry-console';
import { SupabaseCheckInRepository } from '../../../features/workout-generation/infrastructure/supabase/supabase-checkin-repository';
import { SupabaseWorkoutRepository } from '../../../features/workout-generation/infrastructure/supabase/supabase-workout-repository';
import { getActiveLimitations } from '../../../features/workout-generation/infrastructure/supabase/supabase-limitations-query';
import { getProfileGoal } from '../../../features/workout-generation/infrastructure/supabase/supabase-profile-query';
import { requireUser } from '../_shared/require-user';
import { jsonError, jsonOk } from '../_shared/api-error';
import { isDemoUser } from '../_shared/demo-users';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireUser(request, { url: import.meta.env.SUPABASE_URL, anonKey: import.meta.env.SUPABASE_ANON_KEY });
  if (auth instanceof Response) return auth;
  const { userId, supabase } = auth;

  const date = new Date().toISOString().slice(0, 10);
  const checkInRepository = new SupabaseCheckInRepository(supabase);
  const checkIn = await checkInRepository.getCheckInForDate(userId, date);
  // NORMAL/DELOAD is the only decision generate acts on — no check-in yet,
  // an unresolved CHOICE, and an already-resolved ACTIVE_RECOVERY/REST all
  // mean there is nothing for generate to do (ADR-0011 decision 1).
  if (!checkIn.ok || (checkIn.value.decision.kind !== 'NORMAL' && checkIn.value.decision.kind !== 'DELOAD')) {
    return jsonError(400, 'no-decision', "Today's check-in has not resolved to a NORMAL/DELOAD decision.");
  }

  const goal = await getProfileGoal(supabase, userId);
  if (!goal) return jsonError(500, 'profile-missing', 'No profile found for this user.');

  const workoutRepository = new SupabaseWorkoutRepository(supabase);
  const [storedLimitations, recentLogsResult] = await Promise.all([
    getActiveLimitations(supabase, userId),
    workoutRepository.getRecentSetLogs(userId, new Date(), RECENT_HISTORY_WINDOW_DAYS),
  ]);
  const historySummary = buildHistorySummary(recentLogsResult.ok ? recentLogsResult.value : [], new Date());

  const planRequest: PlanRequest = {
    mode: checkIn.value.decision.kind,
    goal,
    availableMinutes: checkIn.value.checkIn.availableMinutes,
    equipmentContext: checkIn.value.checkIn.equipmentContext,
    effectiveLimitations: effectiveLimitationsForToday(storedLimitations, checkIn.value.checkIn),
    catalog: EXERCISE_CATALOG,
    historySummary,
  };

  // Atomic increment happens before any provider is called, quota exceeded
  // is invisible to the client (ADR-0007 decision 4, ADR-0011 decision 3).
  const { data: quotaCount, error: quotaError } = await supabase.rpc('increment_generation_quota', {
    p_user_id: userId,
    p_date: date,
  });
  if (quotaError) return jsonError(500, 'quota-failed', 'Could not update generation quota.');

  const demo = isDemoUser(userId);
  // A demo account never reaches Groq/OpenRouter, and — unlike the normal
  // quota above — actually stops once its (much lower) cap is hit, rather
  // than silently degrading (see DEMO_DAILY_GENERATION_LIMIT).
  if (demo && (quotaCount as number) > DEMO_DAILY_GENERATION_LIMIT) {
    return jsonError(429, 'demo-limit-reached', 'The demo account is limited to a few generations per day. Please try again tomorrow.');
  }

  const withinQuota = (quotaCount as number) <= DAILY_GENERATION_LIMIT;
  const planner =
    demo || !withinQuota
      ? new FallbackChainPlanner([new DeterministicPlanner()], new ConsolePlannerTelemetry())
      : createWorkoutPlanner({
          groq: { apiKey: import.meta.env.GROQ_API_KEY, model: import.meta.env.GROQ_MODEL, baseUrl: import.meta.env.GROQ_BASE_URL },
          openrouter: {
            apiKey: import.meta.env.OPENROUTER_API_KEY,
            model: import.meta.env.OPENROUTER_MODEL,
            baseUrl: import.meta.env.OPENROUTER_BASE_URL,
          },
        });

  let plan;
  try {
    plan = await planner.generate(planRequest);
  } catch (err) {
    if (err instanceof NoPlannerAvailableError) return jsonError(500, 'no-planner-available', err.message);
    throw err;
  }

  const saved = await workoutRepository.savePlan(userId, date, plan);
  if (!saved.ok) return jsonError(500, 'save-failed', 'Could not save generated plan.');

  return jsonOk({ id: saved.value.id, plan: saved.value.plan });
};
