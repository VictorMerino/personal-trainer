import { describe, expect, it } from 'vitest';
import { isSuitableFor } from './contraindication-policy';
import { EXERCISE_CATALOG } from './catalog';
import type { Exercise } from './exercise.schema';
import type { Limitation } from '../limitation.schema';

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'test-exercise',
    name: 'Test exercise',
    kind: 'strength',
    pattern: 'knee-dominant',
    roles: ['main'],
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: [],
    equipment: ['none'],
    level: 'beginner',
    jointStress: { knee: 'moderate' },
    impact: 'none',
    unilateral: false,
    progression: 'reps',
    defaultRepRange: { min: 8, max: 12 },
    defaultRestSeconds: 60,
    cues: [],
    ...overrides,
  };
}

describe('isSuitableFor', () => {
  it('returns true when there are no active limitations', () => {
    expect(isSuitableFor(exercise({ jointStress: { knee: 'high' } }), [])).toBe(true);
  });

  it('ignores resolved (inactive) limitations', () => {
    const limitations: Limitation[] = [{ zone: 'knee', severity: 'severe', isActive: false }];
    expect(isSuitableFor(exercise({ jointStress: { knee: 'high' } }), limitations)).toBe(true);
  });

  it.each([
    ['mild', 'moderate', true],
    ['mild', 'high', false],
    ['moderate', 'low', true],
    ['moderate', 'moderate', false],
    ['severe', 'none', true],
    ['severe', 'low', false],
  ] as const)('severity %s caps allowed stress: %s exercise stress -> suitable=%s', (severity, stress, expected) => {
    const limitations: Limitation[] = [{ zone: 'knee', severity, isActive: true }];
    expect(isSuitableFor(exercise({ jointStress: { knee: stress } }), limitations)).toBe(expected);
  });

  it('treats an unlisted zone as no stress', () => {
    const limitations: Limitation[] = [{ zone: 'shoulder', severity: 'severe', isActive: true }];
    expect(isSuitableFor(exercise({ jointStress: { knee: 'high' } }), limitations)).toBe(true);
  });

  it('excludes a high-knee-stress exercise under a moderate knee limitation, leaves the rest of the catalog untouched (brief worked example)', () => {
    const bulgarianSplitSquat = EXERCISE_CATALOG.find((e) => e.id === 'bulgarian-split-squat-dumbbell')!;
    const romanianDeadlift = EXERCISE_CATALOG.find((e) => e.id === 'dumbbell-romanian-deadlift')!;
    const overheadPress = EXERCISE_CATALOG.find((e) => e.id === 'dumbbell-shoulder-press')!;
    const limitations: Limitation[] = [{ zone: 'knee', severity: 'moderate', isActive: true }];

    expect(isSuitableFor(bulgarianSplitSquat, limitations)).toBe(false);
    expect(isSuitableFor(romanianDeadlift, limitations)).toBe(true);
    expect(isSuitableFor(overheadPress, limitations)).toBe(true);
  });

  it('requires every active limitation to be satisfied', () => {
    const limitations: Limitation[] = [
      { zone: 'knee', severity: 'mild', isActive: true },
      { zone: 'shoulder', severity: 'severe', isActive: true },
    ];
    expect(
      isSuitableFor(exercise({ jointStress: { knee: 'low', shoulder: 'low' } }), limitations),
    ).toBe(false);
  });
});
