import { describe, expect, it } from 'vitest';
import { computeEffectivePrescription, type ProgressionState } from './exercise-progression';
import type { ExerciseSessionRecord } from './stall-detection';

function state(overrides: Partial<ProgressionState> = {}): ProgressionState {
  return {
    currentLoadKg: 40,
    recentSessions: [],
    justReintroduced: false,
    ...overrides,
  };
}

const HELD: ExerciseSessionRecord = { loadKg: 40, avgActualRpe: 8, targetRpe: 8 };

describe('computeEffectivePrescription', () => {
  it('holds the load with no RPE cap when nothing special is going on', () => {
    expect(computeEffectivePrescription(state())).toEqual({ loadKg: 40 });
  });

  it('applies a reintroduction cap and reduced load on the first session back', () => {
    const result = computeEffectivePrescription(state({ justReintroduced: true }));
    expect(result.loadKg).toBe(32);
    expect(result.rpeTargetCap).toBe(6);
  });

  it('applies a stall-backoff cap, holding the load, when the exercise has stalled', () => {
    const result = computeEffectivePrescription(
      state({ recentSessions: [HELD, HELD, HELD] }),
    );
    expect(result).toEqual({ loadKg: 40, rpeTargetCap: 6 });
  });

  it('resumes normal autoregulation the session after a stall-backoff, once history clears', () => {
    // The backoff session itself resets the counter — an empty/short history
    // afterwards no longer reads as stalled.
    const result = computeEffectivePrescription(state({ recentSessions: [HELD] }));
    expect(result).toEqual({ loadKg: 40 });
  });

  it('prioritizes reintroduction over a coincidentally-stalled history', () => {
    const result = computeEffectivePrescription(
      state({ justReintroduced: true, recentSessions: [HELD, HELD, HELD] }),
    );
    expect(result.rpeTargetCap).toBe(6);
    expect(result.loadKg).toBe(32);
  });
});
