import { describe, expect, it } from 'vitest';
import { isBusinessValid } from './business-validation';
import { WORKOUT_PLAN_SCHEMA_VERSION, type WorkoutPlan } from './workout-plan.schema';

function planReferencing(...exerciseIds: string[]): WorkoutPlan {
  return {
    mode: 'NORMAL',
    blocks: [
      {
        role: 'main',
        exercises: exerciseIds.map((exerciseId) => ({
          exerciseId,
          sets: [{ kind: 'reps', reps: { min: 8, max: 12 }, rpeTarget: 7 }],
        })),
      },
    ],
    generatedBy: 'groq',
    schemaVersion: WORKOUT_PLAN_SCHEMA_VERSION,
    promptVersion: 1,
  };
}

describe('isBusinessValid', () => {
  it('rejects a plan referencing an exercise outside the permitted set', () => {
    const permitted = new Set(['goblet-squat-dumbbell']);
    const plan = planReferencing('goblet-squat-dumbbell', 'barbell-back-squat');

    expect(isBusinessValid(plan, permitted)).toBe(false);
  });

  it('accepts a plan whose every exercise is in the permitted set', () => {
    const permitted = new Set(['goblet-squat-dumbbell', 'dumbbell-shoulder-press']);
    const plan = planReferencing('goblet-squat-dumbbell', 'dumbbell-shoulder-press');

    expect(isBusinessValid(plan, permitted)).toBe(true);
  });

  it('accepts a plan with no blocks', () => {
    const plan: WorkoutPlan = {
      mode: 'ACTIVE_RECOVERY',
      blocks: [],
      generatedBy: 'deterministic',
      schemaVersion: WORKOUT_PLAN_SCHEMA_VERSION,
      promptVersion: null,
    };
    expect(isBusinessValid(plan, new Set())).toBe(true);
  });
});
