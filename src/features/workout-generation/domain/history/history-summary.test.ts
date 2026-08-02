import { describe, expect, it } from 'vitest';
import { buildHistorySummary } from './history-summary';
import type { SetLogRecord } from './set-log-record.schema';

function record(overrides: Partial<SetLogRecord> = {}): SetLogRecord {
  return {
    exerciseId: 'back-squat',
    pattern: 'knee-dominant',
    workoutPlanId: 'plan-1',
    loggedAt: new Date('2026-07-30'),
    actualRpe: 8,
    targetRpe: 8,
    actualLoadKg: 42.5,
    ...overrides,
  };
}

const ASOF = new Date('2026-08-06');

describe('buildHistorySummary', () => {
  it('is a pure function: identical input produces deep-equal results', () => {
    const records = [record()];
    expect(buildHistorySummary(records, ASOF)).toEqual(buildHistorySummary(records, ASOF));
  });

  it('reflects the most recent use and load for an exercise', () => {
    const records = [
      record({ workoutPlanId: 'plan-0', loggedAt: new Date('2026-07-20'), actualLoadKg: 40 }),
      record({ workoutPlanId: 'plan-1', loggedAt: new Date('2026-07-30'), actualLoadKg: 42.5 }),
    ];
    const summary = buildHistorySummary(records, ASOF);
    expect(summary.perExercise['back-squat']).toMatchObject({
      lastUsedAt: new Date('2026-07-30'),
      currentLoadKg: 42.5,
    });
  });

  it('counts pattern volume as sets, not tonnage, comparable across load and bodyweight exercises', () => {
    const records = [
      record({ exerciseId: 'barbell-back-squat', workoutPlanId: 'p1' }),
      record({ exerciseId: 'barbell-back-squat', workoutPlanId: 'p1' }),
      record({ exerciseId: 'barbell-back-squat', workoutPlanId: 'p1' }),
      record({ exerciseId: 'bodyweight-split-squat', workoutPlanId: 'p1', actualLoadKg: null }),
      record({ exerciseId: 'bodyweight-split-squat', workoutPlanId: 'p1', actualLoadKg: null }),
      record({ exerciseId: 'bodyweight-split-squat', workoutPlanId: 'p1', actualLoadKg: null }),
      record({ exerciseId: 'bodyweight-split-squat', workoutPlanId: 'p1', actualLoadKg: null }),
    ];
    const summary = buildHistorySummary(records, ASOF);
    expect(summary.perPattern['knee-dominant'].volume).toBe(7);
  });

  it('gives a null (not zero) daysSinceTrained for a pattern never trained', () => {
    const summary = buildHistorySummary([], ASOF);
    expect(summary.perPattern['vertical-pull'].daysSinceTrained).toBeNull();
    expect(summary.perPattern['vertical-pull'].volume).toBe(0);
  });

  it('excludes sets outside the recency window from volume and recentMeanRpe, but not from daysSinceTrained', () => {
    const oldRecord = record({ loggedAt: new Date('2026-07-01'), actualRpe: 9 }); // >14 days before asOf
    const summary = buildHistorySummary([oldRecord], ASOF);

    expect(summary.perPattern['knee-dominant'].volume).toBe(0);
    expect(summary.perPattern['knee-dominant'].recentMeanRpe).toBeNull();
    expect(summary.perPattern['knee-dominant'].daysSinceTrained).toBe(36);
  });

  it('flags a stalled exercise via stallCounter when load has not increased for 3 sessions', () => {
    const records = [
      record({ workoutPlanId: 'p1', loggedAt: new Date('2026-07-24'), actualRpe: 8, targetRpe: 8, actualLoadKg: 40 }),
      record({ workoutPlanId: 'p2', loggedAt: new Date('2026-07-27'), actualRpe: 8, targetRpe: 8, actualLoadKg: 40 }),
      record({ workoutPlanId: 'p3', loggedAt: new Date('2026-07-30'), actualRpe: 8, targetRpe: 8, actualLoadKg: 40 }),
    ];
    const summary = buildHistorySummary(records, ASOF);
    expect(summary.perExercise['back-squat'].stallCounter).toBe(3);
  });

  it('resets the stall counter to 0 when the most recent session increased the load', () => {
    const records = [
      record({ workoutPlanId: 'p1', loggedAt: new Date('2026-07-24'), actualRpe: 8, targetRpe: 8, actualLoadKg: 40 }),
      record({ workoutPlanId: 'p2', loggedAt: new Date('2026-07-27'), actualRpe: 8, targetRpe: 8, actualLoadKg: 40 }),
      // Most recent session undershot target RPE — load would increase, breaking any streak.
      record({ workoutPlanId: 'p3', loggedAt: new Date('2026-07-30'), actualRpe: 6, targetRpe: 8, actualLoadKg: 40 }),
    ];
    const summary = buildHistorySummary(records, ASOF);
    expect(summary.perExercise['back-squat'].stallCounter).toBe(0);
  });

  it('takes the latest set within a session when a session spans multiple logged timestamps', () => {
    const records = [
      record({ workoutPlanId: 'p1', loggedAt: new Date('2026-07-30T10:00:00Z') }),
      record({ workoutPlanId: 'p1', loggedAt: new Date('2026-07-30T10:05:00Z') }),
    ];
    const summary = buildHistorySummary(records, ASOF);
    expect(summary.perExercise['back-squat'].lastUsedAt).toEqual(new Date('2026-07-30T10:05:00Z'));
  });

  it('does not compute a stall counter for an exercise with no load data at all', () => {
    const records = [
      record({ exerciseId: 'push-up', workoutPlanId: 'p1', actualLoadKg: null }),
      record({ exerciseId: 'push-up', workoutPlanId: 'p2', actualLoadKg: null }),
      record({ exerciseId: 'push-up', workoutPlanId: 'p3', actualLoadKg: null }),
    ];
    const summary = buildHistorySummary(records, ASOF);
    expect(summary.perExercise['push-up'].stallCounter).toBe(0);
  });
});
