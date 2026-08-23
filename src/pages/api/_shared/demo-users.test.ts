import { afterEach, describe, expect, it } from 'vitest';
import { isDemoUser } from './demo-users';

describe('isDemoUser', () => {
  const original = import.meta.env.PUBLIC_DEMO_USER_IDS;

  afterEach(() => {
    import.meta.env.PUBLIC_DEMO_USER_IDS = original;
  });

  it('is false when PUBLIC_DEMO_USER_IDS is unset', () => {
    import.meta.env.PUBLIC_DEMO_USER_IDS = undefined;
    expect(isDemoUser('user-1')).toBe(false);
  });

  it('matches an id in a comma-separated list, ignoring surrounding whitespace', () => {
    import.meta.env.PUBLIC_DEMO_USER_IDS = ' user-1, user-2 ';
    expect(isDemoUser('user-1')).toBe(true);
    expect(isDemoUser('user-2')).toBe(true);
    expect(isDemoUser('user-3')).toBe(false);
  });
});
