import { describe, expect, it } from 'vitest';
import { selectPatternsForSession } from './pattern-selection';
import { ACCESSORY_PATTERN_PRIORITY, CORE_PATTERN_PRIORITY } from './generator.constants';

describe('selectPatternsForSession', () => {
  it('includes the full core pattern list when time is plenty', () => {
    const result = selectPatternsForSession(90);
    for (const pattern of CORE_PATTERN_PRIORITY) {
      expect(result).toContain(pattern);
    }
  });

  it('adds accessories only once the core list is covered and time remains', () => {
    const minutesForEveryPattern = (CORE_PATTERN_PRIORITY.length + ACCESSORY_PATTERN_PRIORITY.length) * 8;
    const result = selectPatternsForSession(minutesForEveryPattern);
    expect(result).toEqual([...CORE_PATTERN_PRIORITY, ...ACCESSORY_PATTERN_PRIORITY]);
  });

  it('trims to the top-priority core patterns when time is limited', () => {
    const result = selectPatternsForSession(16); // 2 slots at 8 min/exercise
    expect(result).toEqual(CORE_PATTERN_PRIORITY.slice(0, 2));
  });

  it('always selects at least one pattern, even with very little time', () => {
    const result = selectPatternsForSession(1);
    expect(result).toEqual([CORE_PATTERN_PRIORITY[0]]);
  });
});
