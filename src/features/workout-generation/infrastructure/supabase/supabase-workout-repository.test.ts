import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseWorkoutRepository } from './supabase-workout-repository';
import type { WorkoutPlan } from '../../domain/workout-plan/workout-plan.schema';

function plan(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
  return {
    mode: 'NORMAL',
    blocks: [
      {
        role: 'main',
        exercises: [
          {
            exerciseId: 'back-squat',
            sets: [
              { kind: 'load', reps: { min: 5, max: 8 }, loadKg: 80, rpeTarget: 8 },
              { kind: 'load', reps: { min: 5, max: 8 }, loadKg: 80, rpeTarget: 8.5 },
            ],
          },
        ],
      },
    ],
    generatedBy: 'deterministic',
    schemaVersion: 1,
    promptVersion: null,
    ...overrides,
  };
}

// Minimal stand-in for the chunk of the fluent query builder each method
// actually calls — real Supabase client is a thin fluent wrapper, so this
// stays close to the shape without pulling in a live connection.
function fakeClient(overrides: Record<string, unknown>): SupabaseClient {
  return { from: vi.fn(() => overrides) } as unknown as SupabaseClient;
}

describe('SupabaseWorkoutRepository', () => {
  describe('savePlan', () => {
    it('returns the stored plan when the insert round-trips a valid row', async () => {
      const row = { id: 'plan-1', user_id: 'user-1', date: '2026-08-04', plan: plan() };
      const single = vi.fn().mockResolvedValue({ data: row, error: null });
      const select = vi.fn(() => ({ single }));
      const insert = vi.fn(() => ({ select }));
      const repo = new SupabaseWorkoutRepository(fakeClient({ insert }));

      const result = await repo.savePlan('user-1', '2026-08-04', plan());

      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-1', date: '2026-08-04', generated_by: 'deterministic' }),
      );
      expect(result).toEqual({ ok: true, value: { id: 'plan-1', userId: 'user-1', date: '2026-08-04', plan: plan() } });
    });

    it('fails validation when the round-tripped row does not match WorkoutPlanSchema', async () => {
      const row = { id: 'plan-1', user_id: 'user-1', date: '2026-08-04', plan: { mode: 'BOGUS' } };
      const single = vi.fn().mockResolvedValue({ data: row, error: null });
      const repo = new SupabaseWorkoutRepository(
        fakeClient({ insert: vi.fn(() => ({ select: vi.fn(() => ({ single })) })) }),
      );

      const result = await repo.savePlan('user-1', '2026-08-04', plan());

      expect(result).toEqual({ ok: false, error: { kind: 'validation-failed', message: expect.any(String) } });
    });
  });

  describe('getPlan', () => {
    it('reports not-found when no row matches', async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const eqChain: { eq: (...args: unknown[]) => typeof eqChain; maybeSingle: typeof maybeSingle } = {
        eq: vi.fn(() => eqChain),
        maybeSingle,
      };
      const repo = new SupabaseWorkoutRepository(fakeClient({ select: vi.fn(() => eqChain) }));

      const result = await repo.getPlan('user-1', 'missing');

      expect(result).toEqual({ ok: false, error: { kind: 'not-found', message: expect.any(String) } });
    });

    it('scopes the read to both the plan id and the calling user, not RLS alone', async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const eqChain: { eq: (...args: unknown[]) => typeof eqChain; maybeSingle: typeof maybeSingle } = {
        eq: vi.fn(() => eqChain),
        maybeSingle,
      };
      const repo = new SupabaseWorkoutRepository(fakeClient({ select: vi.fn(() => eqChain) }));

      await repo.getPlan('user-1', 'plan-1');

      expect(eqChain.eq).toHaveBeenCalledWith('id', 'plan-1');
      expect(eqChain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });
  });

  describe('deletePlan', () => {
    it('scopes the delete to both the plan id and the calling user', async () => {
      const secondEq = vi.fn().mockResolvedValue({ error: null });
      const firstEq = vi.fn(() => ({ eq: secondEq }));
      const del = vi.fn(() => ({ eq: firstEq }));
      const repo = new SupabaseWorkoutRepository(fakeClient({ delete: del }));

      const result = await repo.deletePlan('user-1', 'plan-1');

      expect(firstEq).toHaveBeenCalledWith('id', 'plan-1');
      expect(secondEq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(result).toEqual({ ok: true, value: undefined });
    });
  });

  describe('getRecentSetLogs', () => {
    it('joins each set log against its plan to derive the target RPE it was logged against', async () => {
      const row = {
        exercise_id: 'back-squat',
        movement_pattern: 'knee-dominant',
        workout_plan_id: 'plan-1',
        logged_at: '2026-08-01T00:00:00.000Z',
        set_index: 1,
        actual_rpe: 9,
        actual_load_kg: 82.5,
        workout_plans: { plan: plan() },
      };
      const gte = vi.fn().mockResolvedValue({ data: [row], error: null });
      const eq = vi.fn(() => ({ gte }));
      const repo = new SupabaseWorkoutRepository(fakeClient({ select: vi.fn(() => ({ eq })) }));

      const result = await repo.getRecentSetLogs('user-1', new Date('2026-08-04T00:00:00.000Z'), 14);

      expect(result).toEqual({
        ok: true,
        value: [
          {
            exerciseId: 'back-squat',
            pattern: 'knee-dominant',
            workoutPlanId: 'plan-1',
            loggedAt: new Date('2026-08-01T00:00:00.000Z'),
            actualRpe: 9,
            targetRpe: 8.5,
            actualLoadKg: 82.5,
          },
        ],
      });
    });

    it('drops rows whose exercise/set index is no longer found in the joined plan', async () => {
      const row = {
        exercise_id: 'unknown-exercise',
        movement_pattern: 'knee-dominant',
        workout_plan_id: 'plan-1',
        logged_at: '2026-08-01T00:00:00.000Z',
        set_index: 0,
        actual_rpe: 9,
        actual_load_kg: null,
        workout_plans: { plan: plan() },
      };
      const gte = vi.fn().mockResolvedValue({ data: [row], error: null });
      const eq = vi.fn(() => ({ gte }));
      const repo = new SupabaseWorkoutRepository(fakeClient({ select: vi.fn(() => ({ eq })) }));

      const result = await repo.getRecentSetLogs('user-1', new Date('2026-08-04T00:00:00.000Z'), 14);

      expect(result).toEqual({ ok: true, value: [] });
    });
  });
});
