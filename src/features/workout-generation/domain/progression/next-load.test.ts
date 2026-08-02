import { describe, expect, it } from 'vitest';
import { nextLoad } from './next-load';

describe('nextLoad', () => {
  it('increases load by LOAD_INCREMENT_PCT when the session felt too easy (undershoot)', () => {
    expect(nextLoad(40, 6, 8)).toBeCloseTo(41, 5);
  });

  it('holds the load when the session was on target', () => {
    expect(nextLoad(40, 8, 8)).toBe(40);
  });

  it('holds the load when the session felt too hard (overshoot) — never auto-decreases', () => {
    expect(nextLoad(40, 9.5, 8)).toBe(40);
  });

  it('holds the load exactly at the undershoot threshold boundary (not strictly below it)', () => {
    expect(nextLoad(40, 6.5, 8)).toBeCloseTo(41, 5);
  });
});
