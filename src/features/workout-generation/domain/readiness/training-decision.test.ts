import { describe, expect, it } from 'vitest';
import { decideTrainingMode } from './training-decision';
import type { DailyCheckIn, PainLevel } from './daily-checkin.schema';

function checkIn(overrides: Partial<DailyCheckIn> = {}): DailyCheckIn {
  return {
    energy: 'high',
    painReports: [],
    availableMinutes: 60,
    equipmentContext: 'gym',
    ...overrides,
  };
}

function withPain(zone: DailyCheckIn['painReports'][number]['zone'], level: PainLevel): DailyCheckIn['painReports'] {
  return [{ zone, level }];
}

describe('decideTrainingMode', () => {
  it('routes severe pain to ACTIVE_RECOVERY regardless of energy or time', () => {
    const result = decideTrainingMode(
      checkIn({ painReports: withPain('knee', 'severe'), energy: 'high', availableMinutes: 90 }),
    );
    expect(result).toEqual({ kind: 'ACTIVE_RECOVERY', reason: 'severe-pain' });
  });

  it('routes moderate pain to DELOAD regardless of energy or time', () => {
    const result = decideTrainingMode(
      checkIn({ painReports: withPain('shoulder', 'moderate'), energy: 'high', availableMinutes: 90 }),
    );
    expect(result).toEqual({ kind: 'DELOAD' });
  });

  it('routes low energy with plenty of time to ACTIVE_RECOVERY, not a smaller workout', () => {
    const result = decideTrainingMode(checkIn({ energy: 'low', availableMinutes: 60 }));
    expect(result).toEqual({ kind: 'ACTIVE_RECOVERY', reason: 'low-energy-high-time' });
  });

  it.each(['none', 'mild'] as const)('deloads on medium energy regardless of time, pain=%s', (pain) => {
    const result = decideTrainingMode(
      checkIn({ energy: 'medium', painReports: pain === 'none' ? [] : withPain('elbow', pain) }),
    );
    expect(result).toEqual({ kind: 'DELOAD' });
  });

  it('trains normally, time-boxed, on high energy with little time', () => {
    const result = decideTrainingMode(checkIn({ energy: 'high', availableMinutes: 15 }));
    expect(result).toEqual({ kind: 'NORMAL' });
  });

  it.each([30, 60])('trains normally on high energy with medium or high time (%i min)', (minutes) => {
    const result = decideTrainingMode(checkIn({ energy: 'high', availableMinutes: minutes }));
    expect(result).toEqual({ kind: 'NORMAL' });
  });

  it.each([15, 30])('is ambiguous (CHOICE) on low energy with low or medium time (%i min)', (minutes) => {
    const result = decideTrainingMode(checkIn({ energy: 'low', availableMinutes: minutes }));
    expect(result).toEqual({ kind: 'CHOICE', options: ['ACTIVE_RECOVERY_WALK', 'REST'] });
  });

  it('takes the worst reported pain across multiple zones for the gate', () => {
    const result = decideTrainingMode(
      checkIn({
        painReports: [
          { zone: 'knee', level: 'mild' },
          { zone: 'shoulder', level: 'severe' },
        ],
      }),
    );
    expect(result).toEqual({ kind: 'ACTIVE_RECOVERY', reason: 'severe-pain' });
  });

  it('is unaffected by a later report that is milder than an earlier one', () => {
    const result = decideTrainingMode(
      checkIn({
        painReports: [
          { zone: 'shoulder', level: 'severe' },
          { zone: 'knee', level: 'mild' },
        ],
      }),
    );
    expect(result).toEqual({ kind: 'ACTIVE_RECOVERY', reason: 'severe-pain' });
  });
});
