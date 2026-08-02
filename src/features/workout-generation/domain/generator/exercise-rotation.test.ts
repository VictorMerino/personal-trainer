import { describe, expect, it } from 'vitest';
import { candidatesForPattern, selectExerciseForPattern } from './exercise-rotation';
import type { Exercise } from '../exercise/exercise.schema';
import type { Limitation } from '../limitation.schema';

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'exercise-a',
    name: 'Exercise A',
    kind: 'strength',
    pattern: 'knee-dominant',
    roles: ['main'],
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: [],
    equipment: ['none'],
    level: 'beginner',
    jointStress: {},
    impact: 'none',
    unilateral: false,
    progression: 'reps',
    defaultRepRange: { min: 8, max: 12 },
    defaultRestSeconds: 60,
    cues: [],
    ...overrides,
  };
}

const NO_LIMITATIONS: Limitation[] = [];

describe('candidatesForPattern', () => {
  it('excludes mobility (cooldown-only) exercises', () => {
    const catalog = [exercise({ id: 'stretch', kind: 'mobility', roles: ['cooldown'] })];
    expect(candidatesForPattern(catalog, 'knee-dominant', 'gym', NO_LIMITATIONS)).toHaveLength(0);
  });

  it('excludes exercises above the current equipment context tier', () => {
    const catalog = [exercise({ id: 'barbell-squat', equipment: ['barbell'] })];
    expect(candidatesForPattern(catalog, 'knee-dominant', 'none', NO_LIMITATIONS)).toHaveLength(0);
    expect(candidatesForPattern(catalog, 'knee-dominant', 'gym', NO_LIMITATIONS)).toHaveLength(1);
  });

  it('allows dumbbell/band equipment under a "basic" context but not barbell/machine', () => {
    const catalog = [
      exercise({ id: 'dumbbell-move', equipment: ['dumbbells'] }),
      exercise({ id: 'barbell-move', equipment: ['barbell'] }),
    ];
    const result = candidatesForPattern(catalog, 'knee-dominant', 'basic', NO_LIMITATIONS);
    expect(result.map((e) => e.id)).toEqual(['dumbbell-move']);
  });

  it('excludes exercises contraindicated by an active limitation', () => {
    const catalog = [exercise({ id: 'high-knee-stress', jointStress: { knee: 'high' } })];
    const limitations: Limitation[] = [{ zone: 'knee', severity: 'moderate', isActive: true }];
    expect(candidatesForPattern(catalog, 'knee-dominant', 'gym', limitations)).toHaveLength(0);
  });
});

describe('selectExerciseForPattern', () => {
  it('picks the never-used candidate over ones with recent history', () => {
    const catalog = [
      exercise({ id: 'a' }),
      exercise({ id: 'b' }),
      exercise({ id: 'c' }),
    ];
    const lastUsed = new Map([
      ['a', new Date('2026-07-20')],
      ['b', new Date('2026-07-28')],
    ]);

    const result = selectExerciseForPattern(catalog, 'knee-dominant', 'gym', NO_LIMITATIONS, lastUsed);

    expect(result?.id).toBe('c');
  });

  it('picks whichever candidate was used longest ago among used ones', () => {
    const catalog = [exercise({ id: 'a' }), exercise({ id: 'b' })];
    const lastUsed = new Map([
      ['a', new Date('2026-07-20')],
      ['b', new Date('2026-07-28')],
    ]);

    const result = selectExerciseForPattern(catalog, 'knee-dominant', 'gym', NO_LIMITATIONS, lastUsed);

    expect(result?.id).toBe('a');
  });

  it('breaks a tie between two never-used candidates deterministically by ID', () => {
    const catalog = [exercise({ id: 'zzz-exercise' }), exercise({ id: 'aaa-exercise' })];

    const first = selectExerciseForPattern(catalog, 'knee-dominant', 'gym', NO_LIMITATIONS, new Map());
    const second = selectExerciseForPattern(catalog, 'knee-dominant', 'gym', NO_LIMITATIONS, new Map());

    expect(first?.id).toBe('aaa-exercise');
    expect(second?.id).toBe('aaa-exercise');
  });

  it('returns undefined when no candidate is valid for the pattern', () => {
    const result = selectExerciseForPattern([], 'knee-dominant', 'gym', NO_LIMITATIONS, new Map());
    expect(result).toBeUndefined();
  });
});
