import { MovementPattern } from '../exercise/exercise.schema';
import type { SetLogRecord } from '../history/set-log-record.schema';
import type { WorkoutPlan } from '../workout-plan/workout-plan.schema';

export interface AdherenceSummary {
  readonly loggedSets: number;
  readonly prescribedSets: number;
  // 0 rather than NaN when prescribedSets is 0 (a brand-new user, or a
  // range with nothing finalized yet) — ADR-0010's "zero adherence, not
  // broken" scenario.
  readonly ratio: number;
}

export interface ProgressSnapshot {
  readonly adherence: AdherenceSummary;
  readonly volumePerPattern: Readonly<Record<MovementPattern, number>>;
}

function countPrescribedSets(plan: WorkoutPlan): number {
  return plan.blocks.reduce((sum, block) => sum + block.exercises.reduce((s, e) => s + e.sets.length, 0), 0);
}

// Pure, deterministic view over already-fetched, already-windowed data —
// same discipline as buildHistorySummary (ADR-0010 decision 1: nothing is
// persisted, no I/O happens here). Callers are responsible for having
// already filtered finalizedPlans/recentSetLogs to only finalized
// sessions within the requested range (ADR-0009 decision 4/ADR-0010
// decision 4) — a workout_plans row with zero prescribed sets (a REST
// day, ADR-0011 decision 4) naturally contributes 0 to both totals here,
// which is equivalent to excluding it from the denominator.
export function computeProgressSnapshot(
  finalizedPlans: readonly WorkoutPlan[],
  recentSetLogs: readonly SetLogRecord[],
): ProgressSnapshot {
  const prescribedSets = finalizedPlans.reduce((sum, plan) => sum + countPrescribedSets(plan), 0);
  const loggedSets = recentSetLogs.length;

  const volumePerPattern = {} as Record<MovementPattern, number>;
  for (const pattern of MovementPattern.options) {
    volumePerPattern[pattern] = recentSetLogs.filter((log) => log.pattern === pattern).length;
  }

  return {
    adherence: { loggedSets, prescribedSets, ratio: prescribedSets === 0 ? 0 : loggedSets / prescribedSets },
    volumePerPattern,
  };
}
