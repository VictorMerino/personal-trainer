import { describe, expect, it } from 'vitest';
import { effectiveLimitationsForToday } from './effective-limitations';
import type { Limitation } from '../limitation.schema';
import type { DailyCheckIn } from './daily-checkin.schema';

function checkIn(painReports: DailyCheckIn['painReports']): DailyCheckIn {
  return { energy: 'high', painReports, availableMinutes: 60, equipmentContext: 'gym' };
}

describe('effectiveLimitationsForToday', () => {
  it('merges today pain with a stored limitation, taking the higher severity', () => {
    const stored: Limitation[] = [{ zone: 'knee', severity: 'mild', isActive: true }];
    const today = checkIn([{ zone: 'knee', level: 'severe' }]);

    const result = effectiveLimitationsForToday(stored, today);

    expect(result).toEqual([{ zone: 'knee', severity: 'severe', isActive: true }]);
    expect(stored).toEqual([{ zone: 'knee', severity: 'mild', isActive: true }]);
  });

  it('includes same-day pain for a zone with no stored limitation', () => {
    const result = effectiveLimitationsForToday([], checkIn([{ zone: 'shoulder', level: 'moderate' }]));
    expect(result).toEqual([{ zone: 'shoulder', severity: 'moderate', isActive: true }]);
  });

  it('does not carry forward a prior limitation when today reports no pain there and none is stored', () => {
    const result = effectiveLimitationsForToday([], checkIn([{ zone: 'knee', level: 'none' }]));
    expect(result).toEqual([]);
  });

  it('keeps a stored limitation when today reports no pain for that zone', () => {
    const stored: Limitation[] = [{ zone: 'knee', severity: 'moderate', isActive: true }];
    const result = effectiveLimitationsForToday(stored, checkIn([]));
    expect(result).toEqual([{ zone: 'knee', severity: 'moderate', isActive: true }]);
  });

  it('ignores resolved (inactive) stored limitations', () => {
    const stored: Limitation[] = [{ zone: 'knee', severity: 'severe', isActive: false }];
    const result = effectiveLimitationsForToday(stored, checkIn([]));
    expect(result).toEqual([]);
  });

  it('keeps the lower stored severity when today pain in the same zone is lower', () => {
    const stored: Limitation[] = [{ zone: 'knee', severity: 'severe', isActive: true }];
    const result = effectiveLimitationsForToday(stored, checkIn([{ zone: 'knee', level: 'mild' }]));
    expect(result).toEqual([{ zone: 'knee', severity: 'severe', isActive: true }]);
  });
});
