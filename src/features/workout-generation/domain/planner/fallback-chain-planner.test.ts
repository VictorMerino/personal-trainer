import { describe, expect, it, vi } from 'vitest';
import { FallbackChainPlanner } from './fallback-chain-planner';
import { NoPlannerAvailableError } from './no-planner-available.error';
import type { PlannerTelemetry } from './planner-telemetry';
import type { PlanRequest, PlannerResult, WorkoutPlanner } from './workout-planner.port';
import { WORKOUT_PLAN_SCHEMA_VERSION, type WorkoutPlan } from '../workout-plan/workout-plan.schema';

const PLAN: WorkoutPlan = {
  mode: 'NORMAL',
  blocks: [],
  generatedBy: 'groq',
  schemaVersion: WORKOUT_PLAN_SCHEMA_VERSION,
  promptVersion: 1,
};

const REQUEST = {} as PlanRequest;

function fakePlanner(name: WorkoutPlanner['name'], result: PlannerResult): WorkoutPlanner {
  return { name, tryGenerate: vi.fn().mockResolvedValue(result) };
}

function fakeTelemetry(): PlannerTelemetry {
  return { record: vi.fn() };
}

describe('FallbackChainPlanner', () => {
  it('returns the first successful planner result without calling later links', async () => {
    const groq = fakePlanner('groq', { ok: false, error: { kind: 'rate-limited', message: 'nope' } });
    const openrouter = fakePlanner('openrouter', { ok: true, plan: PLAN });
    const deterministic = fakePlanner('deterministic', { ok: true, plan: PLAN });
    const telemetry = fakeTelemetry();

    const result = await new FallbackChainPlanner([groq, openrouter, deterministic], telemetry).generate(REQUEST);

    expect(result).toBe(PLAN);
    expect(deterministic.tryGenerate).not.toHaveBeenCalled();
  });

  it('records telemetry only for planners that failed, not ones that succeeded or were never reached', async () => {
    const groq = fakePlanner('groq', { ok: false, error: { kind: 'timeout', message: 'slow' } });
    const openrouter = fakePlanner('openrouter', { ok: true, plan: PLAN });
    const deterministic = fakePlanner('deterministic', { ok: true, plan: PLAN });
    const telemetry = fakeTelemetry();

    await new FallbackChainPlanner([groq, openrouter, deterministic], telemetry).generate(REQUEST);

    expect(telemetry.record).toHaveBeenCalledTimes(1);
    expect(telemetry.record).toHaveBeenCalledWith('groq', { kind: 'timeout', message: 'slow' });
  });

  it('throws NoPlannerAvailableError, never returning a degraded plan, when the whole chain fails', async () => {
    const failure = { ok: false, error: { kind: 'network-error', message: 'down' } } as const;
    const groq = fakePlanner('groq', failure);
    const openrouter = fakePlanner('openrouter', failure);
    const deterministic = fakePlanner('deterministic', failure);
    const telemetry = fakeTelemetry();

    await expect(
      new FallbackChainPlanner([groq, openrouter, deterministic], telemetry).generate(REQUEST),
    ).rejects.toThrow(NoPlannerAvailableError);
    expect(telemetry.record).toHaveBeenCalledTimes(3);
  });
});
