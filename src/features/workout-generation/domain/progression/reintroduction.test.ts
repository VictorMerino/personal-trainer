import { describe, expect, it } from 'vitest';
import { reintroductionLoadKg } from './reintroduction';

describe('reintroductionLoadKg', () => {
  it('returns 80% of the last known working load', () => {
    expect(reintroductionLoadKg(40)).toBe(32);
  });
});
