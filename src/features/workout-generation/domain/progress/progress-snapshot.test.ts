import { describe, expect, it } from 'vitest';
import { computeProgressSnapshot } from './progress-snapshot';
import type { WorkoutPlan } from '../workout-plan/workout-plan.schema';
import type { SetLogRecord } from '../history/set-log-record.schema';

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
              { kind: 'load', reps: { min: 5, max: 8 }, loadKg: 80, rpeTarget: 8 },
              { kind: 'load', reps: { min: 5, max: 8 }, loadKg: 80, rpeTarget: 8 },
              { kind: 'load', reps: { min: 5, max: 8 }, loadKg: 80, rpeTarget: 8 },
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

function setLog(overrides: Partial<SetLogRecord> = {}): SetLogRecord {
  return {
    exerciseId: 'back-squat',
    pattern: 'knee-dominant',
    workoutPlanId: 'plan-1',
    loggedAt: new Date('2026-08-01'),
    actualRpe: 8,
    targetRpe: 8,
    actualLoadKg: 80,
    ...overrides,
  };
}

describe('computeProgressSnapshot', () => {
  it('reads only the inputs given it and writes nothing — a pure function over already-fetched data', () => {
    const finalizedPlans = [plan()];
    const setLogs = [setLog(), setLog()];
    const a = computeProgressSnapshot(finalizedPlans, setLogs);
    const b = computeProgressSnapshot(finalizedPlans, setLogs);
    expect(a).toEqual(b);
  });

  it('is deterministic for a fixed input', () => {
    const finalizedPlans = [plan()];
    const setLogs = [setLog()];
    expect(computeProgressSnapshot(finalizedPlans, setLogs)).toEqual(computeProgressSnapshot(finalizedPlans, setLogs));
  });

  it('aggregates logged over prescribed sets across all given finalized plans', () => {
    const finalizedPlans = [plan(), plan()];
    const setLogs = [setLog(), setLog(), setLog()];
    const snapshot = computeProgressSnapshot(finalizedPlans, setLogs);
    expect(snapshot.adherence).toEqual({ loggedSets: 3, prescribedSets: 8, ratio: 3 / 8 });
  });

  it('a REST day (zero prescribed sets) contributes 0/0, not skewing the ratio', () => {
    const restPlan: WorkoutPlan = { mode: 'ACTIVE_RECOVERY', blocks: [], generatedBy: 'deterministic', schemaVersion: 1, promptVersion: null };
    const snapshot = computeProgressSnapshot([plan(), restPlan], [setLog(), setLog()]);
    expect(snapshot.adherence).toEqual({ loggedSets: 2, prescribedSets: 4, ratio: 0.5 });
  });

  it('counts volume per pattern from the given (already-windowed) set logs only', () => {
    const setLogs = [
      setLog({ pattern: 'knee-dominant' }),
      setLog({ pattern: 'knee-dominant' }),
      setLog({ pattern: 'horizontal-push' }),
    ];
    const snapshot = computeProgressSnapshot([], setLogs);
    expect(snapshot.volumePerPattern['knee-dominant']).toBe(2);
    expect(snapshot.volumePerPattern['horizontal-push']).toBe(1);
    expect(snapshot.volumePerPattern['vertical-pull']).toBe(0);
  });

  it('gives a zero, not broken, snapshot for a brand-new user with no history at all', () => {
    const snapshot = computeProgressSnapshot([], []);
    expect(snapshot.adherence).toEqual({ loggedSets: 0, prescribedSets: 0, ratio: 0 });
    expect(snapshot.volumePerPattern['knee-dominant']).toBe(0);
  });
});
