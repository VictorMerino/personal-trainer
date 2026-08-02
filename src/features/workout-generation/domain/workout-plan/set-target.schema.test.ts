import { describe, expect, it } from 'vitest';
import { SetTargetSchema } from './set-target.schema';

describe('SetTargetSchema', () => {
  it('requires loadKg for a load-based set', () => {
    const result = SetTargetSchema.safeParse({
      kind: 'load',
      reps: { min: 8, max: 12 },
      rpeTarget: 8,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid load-based set', () => {
    const result = SetTargetSchema.safeParse({
      kind: 'load',
      reps: { min: 8, max: 12 },
      loadKg: 40,
      rpeTarget: 8,
    });
    expect(result.success).toBe(true);
  });

  it('reads only seconds and rpeTarget for a time-based set', () => {
    const result = SetTargetSchema.safeParse({
      kind: 'time',
      seconds: 30,
      rpeTarget: 6,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a time-based set carrying a reps field', () => {
    const result = SetTargetSchema.safeParse({
      kind: 'time',
      seconds: 30,
      reps: { min: 8, max: 12 },
      rpeTarget: 6,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a time-based set carrying a loadKg field', () => {
    const result = SetTargetSchema.safeParse({
      kind: 'time',
      seconds: 30,
      loadKg: 20,
      rpeTarget: 6,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a reps-based set with no loadKg', () => {
    const result = SetTargetSchema.safeParse({
      kind: 'reps',
      reps: { min: 10, max: 20 },
      rpeTarget: 7,
    });
    expect(result.success).toBe(true);
  });
});
