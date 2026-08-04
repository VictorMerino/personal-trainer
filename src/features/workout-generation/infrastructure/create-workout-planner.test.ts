import { describe, expect, it, vi } from 'vitest';
import { createWorkoutPlanner } from './create-workout-planner';
import { FallbackChainPlanner } from '../domain/planner/fallback-chain-planner';
import { EXERCISE_CATALOG } from '../domain/exercise/catalog';
import type { PlanRequest } from '../domain/planner/workout-planner.port';

const failingFetch = vi.fn().mockRejectedValue(new Error('network down'));

describe('createWorkoutPlanner', () => {
  it('wires Groq -> OpenRouter -> deterministic into one FallbackChainPlanner', () => {
    const planner = createWorkoutPlanner({
      groq: { apiKey: 'groq-key' },
      openrouter: { apiKey: 'openrouter-key' },
    });

    expect(planner).toBeInstanceOf(FallbackChainPlanner);
  });

  it('falls all the way through to the deterministic generator when both providers are unreachable', async () => {
    const planner = createWorkoutPlanner({
      groq: { apiKey: 'groq-key', fetchImpl: failingFetch },
      openrouter: { apiKey: 'openrouter-key', fetchImpl: failingFetch },
    });

    const request: PlanRequest = {
      mode: 'NORMAL',
      goal: 'hypertrophy',
      availableMinutes: 60,
      equipmentContext: 'gym',
      effectiveLimitations: [],
      catalog: EXERCISE_CATALOG,
      historySummary: { perExercise: {}, perPattern: {} } as unknown as PlanRequest['historySummary'],
    };

    const plan = await planner.generate(request);

    expect(plan.generatedBy).toBe('deterministic');
  });
});
