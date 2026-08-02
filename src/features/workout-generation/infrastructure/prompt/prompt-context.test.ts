import { describe, expect, it } from 'vitest';
import { buildPromptContext } from './prompt-context';
import type { ProfileEssentials } from './prompt-context';
import type { Exercise } from '../../domain/exercise/exercise.schema';
import type { PerPatternSummary } from '../../domain/history/history-summary';
import { MovementPattern } from '../../domain/exercise/exercise.schema';
import type { TrainingDecision } from '../../domain/readiness/training-decision';

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
    cues: ['keep back flat'],
    ...overrides,
  };
}

const EMPTY_PATTERN_SUMMARY: PerPatternSummary = { daysSinceTrained: null, recentMeanRpe: null, volume: 0 };

function history(overrides: Partial<Record<MovementPattern, PerPatternSummary>> = {}) {
  const result = {} as Record<MovementPattern, PerPatternSummary>;
  for (const pattern of MovementPattern.options) {
    result[pattern] = overrides[pattern] ?? EMPTY_PATTERN_SUMMARY;
  }
  return result;
}

const PROFILE: ProfileEssentials = {
  goal: 'hypertrophy',
  availableMinutes: 45,
  equipmentContext: 'gym',
};

const DECISION: TrainingDecision = { kind: 'NORMAL' };

describe('buildPromptContext', () => {
  it('includes only the compact exercise projection', () => {
    const context = buildPromptContext(PROFILE, DECISION, [exercise()], history());

    expect(context.permittedExercises).toEqual([
      { id: 'exercise-a', name: 'Exercise A', pattern: 'knee-dominant', equipment: ['none'], level: 'beginner' },
    ]);
    for (const compact of context.permittedExercises) {
      expect(compact).not.toHaveProperty('jointStress');
      expect(compact).not.toHaveProperty('cues');
      expect(compact).not.toHaveProperty('defaultRestSeconds');
    }
  });

  it('includes only the perPattern history view', () => {
    const perPattern = history({ 'knee-dominant': { daysSinceTrained: 2, recentMeanRpe: 7.5, volume: 12 } });

    const context = buildPromptContext(PROFILE, DECISION, [], perPattern);

    expect(context.history['knee-dominant']).toEqual({ daysSinceTrained: 2, recentMeanRpe: 7.5, volume: 12 });
    expect(context).not.toHaveProperty('perExercise');
  });

  it('contains no free-text user input', () => {
    const context = buildPromptContext(PROFILE, DECISION, [exercise()], history());

    expect(typeof context.goal).toBe('string');
    expect(typeof context.availableMinutes).toBe('number');
    expect(typeof context.equipmentContext).toBe('string');
    expect(context.decision).toEqual(DECISION);
  });

  it('is pure and deterministic', () => {
    const first = buildPromptContext(PROFILE, DECISION, [exercise()], history());
    const second = buildPromptContext(PROFILE, DECISION, [exercise()], history());

    expect(first).toEqual(second);
  });
});
