import { describe, expect, it } from 'vitest';
import { buildSetsForExercise } from './set-sizing';
import type { Exercise } from '../exercise/exercise.schema';
import { DELOAD_RPE_TARGET, DELOAD_SET_COUNT_FLOOR, NORMAL_RPE_TARGET, NORMAL_SET_COUNT } from './generator.constants';

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'goblet-squat-dumbbell',
    name: 'Goblet squat',
    kind: 'strength',
    pattern: 'knee-dominant',
    roles: ['main'],
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: [],
    equipment: ['dumbbells'],
    level: 'beginner',
    jointStress: {},
    impact: 'none',
    unilateral: false,
    progression: 'load',
    defaultRepRange: { min: 8, max: 12 },
    defaultRestSeconds: 60,
    cues: [],
    ...overrides,
  };
}

describe('buildSetsForExercise', () => {
  it.each([
    ['strength', { min: 4, max: 6 }],
    ['hypertrophy', { min: 8, max: 12 }],
    ['general_fitness', { min: 10, max: 15 }],
  ] as const)('sizes reps by goal "%s"', (goal, expectedReps) => {
    const [set] = buildSetsForExercise(exercise({ progression: 'reps' }), goal, 'NORMAL', new Map());
    expect(set).toMatchObject({ kind: 'reps', reps: expectedReps });
  });

  it('uses the current working load when history exists', () => {
    const [set] = buildSetsForExercise(
      exercise(),
      'hypertrophy',
      'NORMAL',
      new Map([['goblet-squat-dumbbell', 42.5]]),
    );
    expect(set).toMatchObject({ kind: 'load', loadKg: 42.5 });
  });

  it('falls back to the default starting load with no history', () => {
    const [set] = buildSetsForExercise(exercise(), 'hypertrophy', 'NORMAL', new Map());
    expect(set).toMatchObject({ kind: 'load', loadKg: 20 });
  });

  it('sizes a time-based exercise from its default rep range midpoint', () => {
    const [set] = buildSetsForExercise(
      exercise({ progression: 'time', defaultRepRange: { min: 20, max: 60 } }),
      'hypertrophy',
      'NORMAL',
      new Map(),
    );
    expect(set).toMatchObject({ kind: 'time', seconds: 40 });
  });

  it('keeps the same exercise selection under DELOAD, only adjusting effort and volume', () => {
    const sets = buildSetsForExercise(exercise(), 'hypertrophy', 'DELOAD', new Map());
    expect(sets).toHaveLength(NORMAL_SET_COUNT - 1);
    expect(sets.every((s) => s.rpeTarget === DELOAD_RPE_TARGET)).toBe(true);
  });

  it('never reduces DELOAD sets below the floor', () => {
    const sets = buildSetsForExercise(exercise(), 'hypertrophy', 'DELOAD', new Map());
    expect(sets.length).toBeGreaterThanOrEqual(DELOAD_SET_COUNT_FLOOR);
  });

  it('prescribes NORMAL_SET_COUNT sets at NORMAL_RPE_TARGET for a NORMAL session', () => {
    const sets = buildSetsForExercise(exercise(), 'hypertrophy', 'NORMAL', new Map());
    expect(sets).toHaveLength(NORMAL_SET_COUNT);
    expect(sets.every((s) => s.rpeTarget === NORMAL_RPE_TARGET)).toBe(true);
  });
});
