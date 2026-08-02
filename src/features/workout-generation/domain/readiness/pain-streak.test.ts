import { describe, expect, it } from 'vitest';
import { hasPainStreak } from './pain-streak';
import type { DailyCheckIn } from './daily-checkin.schema';

function checkInWithKneePain(level: DailyCheckIn['painReports'][number]['level']): DailyCheckIn {
  return {
    energy: 'high',
    painReports: level === 'none' ? [] : [{ zone: 'knee', level }],
    availableMinutes: 60,
    equipmentContext: 'gym',
  };
}

describe('hasPainStreak', () => {
  it('detects a streak of PAIN_STREAK_PROMOTION_DAYS consecutive mild-or-higher reports', () => {
    const history = [checkInWithKneePain('mild'), checkInWithKneePain('moderate'), checkInWithKneePain('mild')];
    expect(hasPainStreak(history, 'knee')).toBe(true);
  });

  it('is false when the streak is broken by a "none" reading', () => {
    const history = [checkInWithKneePain('mild'), checkInWithKneePain('none'), checkInWithKneePain('mild')];
    expect(hasPainStreak(history, 'knee')).toBe(false);
  });

  it('is false when there is not enough history yet', () => {
    const history = [checkInWithKneePain('mild'), checkInWithKneePain('mild')];
    expect(hasPainStreak(history, 'knee')).toBe(false);
  });

  it('only counts the zone asked about', () => {
    const history = [
      { energy: 'high', painReports: [{ zone: 'shoulder', level: 'severe' }], availableMinutes: 60, equipmentContext: 'gym' },
      { energy: 'high', painReports: [{ zone: 'shoulder', level: 'severe' }], availableMinutes: 60, equipmentContext: 'gym' },
      { energy: 'high', painReports: [{ zone: 'shoulder', level: 'severe' }], availableMinutes: 60, equipmentContext: 'gym' },
    ] satisfies DailyCheckIn[];
    expect(hasPainStreak(history, 'knee')).toBe(false);
  });

  it('only looks at the most recent PAIN_STREAK_PROMOTION_DAYS entries', () => {
    const olderBreak = checkInWithKneePain('none');
    const recentStreak = [checkInWithKneePain('mild'), checkInWithKneePain('mild'), checkInWithKneePain('severe')];
    expect(hasPainStreak([...recentStreak, olderBreak], 'knee')).toBe(true);
  });
});
