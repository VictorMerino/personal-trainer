import { describe, expect, it } from 'vitest';
import { WORKOUT_PLAN_SCHEMA_VERSION, WorkoutPlanSchema, type WorkoutPlan } from './workout-plan.schema';

function planWithSets(sets: WorkoutPlan['blocks'][number]['exercises'][number]['sets']) {
  return {
    mode: 'NORMAL',
    blocks: [{ role: 'main', exercises: [{ exerciseId: 'goblet-squat-dumbbell', sets }] }],
    generatedBy: 'deterministic',
    schemaVersion: WORKOUT_PLAN_SCHEMA_VERSION,
    promptVersion: null,
  };
}

describe('WorkoutPlanSchema', () => {
  it('accepts sets within one exercise that differ from each other', () => {
    const result = WorkoutPlanSchema.safeParse(
      planWithSets([
        { kind: 'load', reps: { min: 8, max: 12 }, loadKg: 40, rpeTarget: 7 },
        { kind: 'load', reps: { min: 8, max: 12 }, loadKg: 45, rpeTarget: 8 },
        { kind: 'load', reps: { min: 8, max: 12 }, loadKg: 50, rpeTarget: 9 },
      ]),
    );
    expect(result.success).toBe(true);
  });

  it('validates an active-recovery plan with the same schema, no special case', () => {
    const plan: unknown = {
      mode: 'ACTIVE_RECOVERY',
      blocks: [
        {
          role: 'main',
          exercises: [{ exerciseId: 'walking', sets: [{ kind: 'time', seconds: 900, rpeTarget: 3 }] }],
        },
      ],
      generatedBy: 'deterministic',
      schemaVersion: WORKOUT_PLAN_SCHEMA_VERSION,
      promptVersion: null,
    };

    const result = WorkoutPlanSchema.safeParse(plan);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blocks).toHaveLength(1);
      expect(result.data.blocks[0].role).toBe('main');
      expect(result.data.blocks[0].exercises[0].sets[0].kind).toBe('time');
    }
  });

  it('allows an empty blocks array for a REST resolution', () => {
    const plan: unknown = {
      mode: 'ACTIVE_RECOVERY',
      blocks: [],
      generatedBy: 'deterministic',
      schemaVersion: WORKOUT_PLAN_SCHEMA_VERSION,
      promptVersion: null,
    };
    expect(WorkoutPlanSchema.safeParse(plan).success).toBe(true);
  });

  it('records which link generated the plan', () => {
    const result = WorkoutPlanSchema.safeParse(planWithSets([{ kind: 'reps', reps: { min: 8, max: 12 }, rpeTarget: 7 }]));
    expect(result.success && result.data.generatedBy).toBe('deterministic');
  });

  it('allows a null promptVersion for a deterministic-generated plan', () => {
    const result = WorkoutPlanSchema.safeParse(planWithSets([{ kind: 'reps', reps: { min: 8, max: 12 }, rpeTarget: 7 }]));
    expect(result.success && result.data.promptVersion).toBeNull();
  });

  it('rejects a plan with an unknown mode', () => {
    const plan: unknown = { ...planWithSets([{ kind: 'reps', reps: { min: 8, max: 12 }, rpeTarget: 7 }]), mode: 'EASY' };
    expect(WorkoutPlanSchema.safeParse(plan).success).toBe(false);
  });
});
