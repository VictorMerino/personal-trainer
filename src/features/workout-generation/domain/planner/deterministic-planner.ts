import { generateDeterministicPlan } from '../generator/deterministic-generator';
import type { PlanRequest, PlannerResult, WorkoutPlanner } from './workout-planner.port';

function buildLoadMap(perExercise: PlanRequest['historySummary']['perExercise']): Map<string, number> {
  const entries: (readonly [string, number])[] = [];
  for (const [exerciseId, summary] of Object.entries(perExercise)) {
    if (summary.currentLoadKg !== null) entries.push([exerciseId, summary.currentLoadKg]);
  }
  return new Map(entries);
}

function buildLastUsedMap(perExercise: PlanRequest['historySummary']['perExercise']): Map<string, Date> {
  const entries: (readonly [string, Date])[] = [];
  for (const [exerciseId, summary] of Object.entries(perExercise)) {
    if (summary.lastUsedAt !== null) entries.push([exerciseId, summary.lastUsedAt]);
  }
  return new Map(entries);
}

// The last, network-free link in the fallback chain (ADR-0005 decision 2) —
// by design this call never fails, which is exactly why FallbackChainPlanner
// treats exhausting the whole chain as a thrown bug, not a routine outcome.
export class DeterministicPlanner implements WorkoutPlanner {
  readonly name = 'deterministic' as const;

  async tryGenerate(request: PlanRequest): Promise<PlannerResult> {
    const plan = generateDeterministicPlan({
      catalog: request.catalog,
      mode: request.mode,
      goal: request.goal,
      availableMinutes: request.availableMinutes,
      equipmentContext: request.equipmentContext,
      effectiveLimitations: request.effectiveLimitations,
      lastUsedByExerciseId: buildLastUsedMap(request.historySummary.perExercise),
      currentLoadKgByExerciseId: buildLoadMap(request.historySummary.perExercise),
    });

    return { ok: true, plan };
  }
}
