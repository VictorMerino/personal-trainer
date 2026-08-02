import { describe, expect, it } from 'vitest';
import { generateDeterministicPlan, type DeterministicGeneratorInput } from './deterministic-generator';
import { EXERCISE_CATALOG } from '../exercise/catalog';
import { WorkoutPlanSchema } from '../workout-plan/workout-plan.schema';
import type { Limitation } from '../limitation.schema';

function baseInput(overrides: Partial<DeterministicGeneratorInput> = {}): DeterministicGeneratorInput {
  return {
    catalog: EXERCISE_CATALOG,
    mode: 'NORMAL',
    goal: 'hypertrophy',
    availableMinutes: 60,
    equipmentContext: 'gym',
    effectiveLimitations: [],
    lastUsedByExerciseId: new Map(),
    currentLoadKgByExerciseId: new Map(),
    ...overrides,
  };
}

describe('generateDeterministicPlan', () => {
  it('always returns a schema-valid plan with no network access', () => {
    const plan = generateDeterministicPlan(baseInput());
    expect(WorkoutPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.generatedBy).toBe('deterministic');
  });

  it('targets a spread of core movement patterns when time allows', () => {
    const plan = generateDeterministicPlan(baseInput({ availableMinutes: 90 }));
    const patterns = plan.blocks[0].exercises.map(
      (prescribed) => EXERCISE_CATALOG.find((e) => e.id === prescribed.exerciseId)?.pattern,
    );
    for (const pattern of ['knee-dominant', 'hip-dominant', 'horizontal-push', 'horizontal-pull', 'core-antiextension']) {
      expect(patterns).toContain(pattern);
    }
  });

  it('trims the pattern list when time is limited, while still respecting filters', () => {
    const limitations: Limitation[] = [{ zone: 'shoulder', severity: 'severe', isActive: true }];
    const plan = generateDeterministicPlan(baseInput({ availableMinutes: 16, effectiveLimitations: limitations }));

    expect(plan.blocks[0].exercises.length).toBeLessThanOrEqual(2);
    for (const prescribed of plan.blocks[0].exercises) {
      const exercise = EXERCISE_CATALOG.find((e) => e.id === prescribed.exerciseId)!;
      expect(exercise.jointStress.shoulder ?? 'none').toBe('none');
    }
  });

  it('produces the exact same selection across repeated runs with identical input', () => {
    const input = baseInput();
    const first = generateDeterministicPlan(input);
    const second = generateDeterministicPlan(input);
    expect(second).toEqual(first);
  });

  it('keeps DELOAD to the same exercises as NORMAL would pick, just lighter', () => {
    const normal = generateDeterministicPlan(baseInput({ mode: 'NORMAL' }));
    const deload = generateDeterministicPlan(baseInput({ mode: 'DELOAD' }));

    expect(deload.blocks[0].exercises.map((e) => e.exerciseId)).toEqual(
      normal.blocks[0].exercises.map((e) => e.exerciseId),
    );
    expect(deload.blocks[0].exercises[0].sets.length).toBeLessThan(normal.blocks[0].exercises[0].sets.length);
  });

  it('produces an empty-block NORMAL/DELOAD plan when no candidate is valid for any pattern', () => {
    const plan = generateDeterministicPlan(baseInput({ catalog: [] }));
    expect(plan.blocks).toEqual([]);
  });

  it('produces an empty-block plan for ACTIVE_RECOVERY when no locomotion candidate is valid', () => {
    const plan = generateDeterministicPlan(baseInput({ mode: 'ACTIVE_RECOVERY', catalog: [] }));
    expect(plan).toEqual({
      mode: 'ACTIVE_RECOVERY',
      blocks: [],
      generatedBy: 'deterministic',
      schemaVersion: expect.any(Number),
      promptVersion: null,
    });
  });

  it('produces a single duration+RPE block for ACTIVE_RECOVERY, no other pattern slots', () => {
    const plan = generateDeterministicPlan(baseInput({ mode: 'ACTIVE_RECOVERY' }));

    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0].role).toBe('main');
    expect(plan.blocks[0].exercises).toHaveLength(1);
    expect(plan.blocks[0].exercises[0].sets).toEqual([
      { kind: 'time', seconds: expect.any(Number), rpeTarget: expect.any(Number) },
    ]);
  });
});
