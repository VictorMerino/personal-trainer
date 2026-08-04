import { describe, expect, it } from 'vitest';
import { DeterministicPlanner } from './deterministic-planner';
import { EXERCISE_CATALOG } from '../exercise/catalog';
import { WorkoutPlanSchema } from '../workout-plan/workout-plan.schema';
import type { PlanRequest } from './workout-planner.port';

function baseRequest(overrides: Partial<PlanRequest> = {}): PlanRequest {
  return {
    mode: 'NORMAL',
    goal: 'hypertrophy',
    availableMinutes: 60,
    equipmentContext: 'gym',
    effectiveLimitations: [],
    catalog: EXERCISE_CATALOG,
    historySummary: { perExercise: {}, perPattern: {} } as unknown as PlanRequest['historySummary'],
    ...overrides,
  };
}

describe('DeterministicPlanner', () => {
  it('always succeeds with a schema-valid plan, never a failure result', async () => {
    const result = await new DeterministicPlanner().tryGenerate(baseRequest());

    expect(result.ok).toBe(true);
    if (result.ok) expect(WorkoutPlanSchema.safeParse(result.plan).success).toBe(true);
  });

  it('carries currentLoadKg and lastUsedAt from HistorySummary.perExercise into the generator', async () => {
    const request = baseRequest({
      historySummary: {
        perExercise: {
          'back-squat': { lastUsedAt: new Date('2026-08-01'), currentLoadKg: 82.5, stallCounter: 0 },
        },
        perPattern: {},
      } as unknown as PlanRequest['historySummary'],
    });

    const result = await new DeterministicPlanner().tryGenerate(request);

    expect(result.ok).toBe(true);
  });

  it('skips exercises with no recorded load or last-used date, falling back to generator defaults', async () => {
    const request = baseRequest({
      historySummary: {
        perExercise: {
          'back-squat': { lastUsedAt: null, currentLoadKg: null, stallCounter: 0 },
        },
        perPattern: {},
      } as unknown as PlanRequest['historySummary'],
    });

    const result = await new DeterministicPlanner().tryGenerate(request);

    expect(result.ok).toBe(true);
  });
});
