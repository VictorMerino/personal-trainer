import type { APIRoute } from 'astro';
import { computeProgressSnapshot } from '../../features/workout-generation/domain/progress/progress-snapshot';
import { DEFAULT_PROGRESS_RANGE, PROGRESS_RANGE_DAYS, ProgressRange } from '../../features/workout-generation/domain/progress/progress-range';
import { SupabaseWorkoutRepository } from '../../features/workout-generation/infrastructure/supabase/supabase-workout-repository';
import { requireUser } from './_shared/require-user';
import { jsonError, jsonOk } from './_shared/api-error';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const auth = await requireUser(request, { url: import.meta.env.SUPABASE_URL, anonKey: import.meta.env.SUPABASE_ANON_KEY });
  if (auth instanceof Response) return auth;
  const { userId, supabase } = auth;

  const rangeParam = url.searchParams.get('range') ?? DEFAULT_PROGRESS_RANGE;
  const parsedRange = ProgressRange.safeParse(rangeParam);
  if (!parsedRange.success) return jsonError(400, 'invalid-range', "range must be one of '4w', '8w', '12w'.");

  const windowDays = PROGRESS_RANGE_DAYS[parsedRange.data];
  const asOf = new Date();
  const from = new Date(asOf.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const workoutRepository = new SupabaseWorkoutRepository(supabase);
  const [plansResult, setLogsResult] = await Promise.all([
    workoutRepository.getFinalizedPlansInRange(userId, from, asOf),
    workoutRepository.getRecentSetLogs(userId, asOf, windowDays),
  ]);

  if (!plansResult.ok || !setLogsResult.ok) return jsonError(500, 'read-failed', 'Could not read progress data.');

  const snapshot = computeProgressSnapshot(plansResult.value, setLogsResult.value);
  return jsonOk({ range: parsedRange.data, snapshot });
};
