import { describe, expect, it } from 'vitest';
import { hasStalled, type ExerciseSessionRecord } from './stall-detection';

function heldSession(loadKg = 40): ExerciseSessionRecord {
  return { loadKg, avgActualRpe: 8, targetRpe: 8 }; // on-target, no increase
}

function increasedSession(loadKg = 40): ExerciseSessionRecord {
  return { loadKg, avgActualRpe: 6, targetRpe: 8 }; // undershoot, would increase
}

describe('hasStalled', () => {
  it('is true after STALL_SESSIONS_THRESHOLD consecutive sessions with no load increase', () => {
    expect(hasStalled([heldSession(), heldSession(), heldSession()])).toBe(true);
  });

  it('is false when a recent session would have increased the load', () => {
    expect(hasStalled([heldSession(), increasedSession(), heldSession()])).toBe(false);
  });

  it('is false with fewer sessions than the threshold', () => {
    expect(hasStalled([heldSession(), heldSession()])).toBe(false);
  });

  it('only looks at the most recent STALL_SESSIONS_THRESHOLD sessions', () => {
    const olderIncrease = increasedSession();
    const recentHolds = [heldSession(), heldSession(), heldSession()];
    expect(hasStalled([...recentHolds, olderIncrease])).toBe(true);
  });
});
