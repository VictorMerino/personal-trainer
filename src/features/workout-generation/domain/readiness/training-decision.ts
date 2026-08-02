import type { DailyCheckIn, EnergyLevel, PainLevel } from './daily-checkin.schema';
import { AVAILABLE_MINUTES_LOW_MAX, AVAILABLE_MINUTES_MEDIUM_MAX } from './readiness-policy.constants';

export type ActiveRecoveryReason = 'severe-pain' | 'low-energy-high-time';

export type TrainingDecision =
  | { kind: 'NORMAL' }
  | { kind: 'DELOAD' }
  | { kind: 'ACTIVE_RECOVERY'; reason: ActiveRecoveryReason }
  | { kind: 'CHOICE'; options: readonly ['ACTIVE_RECOVERY_WALK', 'REST'] };

type TimeTier = 'low' | 'medium' | 'high';

const PAIN_RANK: Record<PainLevel, number> = { none: 0, mild: 1, moderate: 2, severe: 3 };

function maxPainLevel(checkIn: DailyCheckIn): PainLevel {
  return checkIn.painReports.reduce<PainLevel>(
    (max, report) => (PAIN_RANK[report.level] > PAIN_RANK[max] ? report.level : max),
    'none',
  );
}

function timeTierFromMinutes(minutes: number): TimeTier {
  if (minutes <= AVAILABLE_MINUTES_LOW_MAX) return 'low';
  if (minutes <= AVAILABLE_MINUTES_MEDIUM_MAX) return 'medium';
  return 'high';
}

function decideForEnergyAndTime(energy: EnergyLevel, time: TimeTier): TrainingDecision {
  if (energy === 'medium') return { kind: 'DELOAD' };
  if (energy === 'high') return { kind: 'NORMAL' };
  // energy === 'low'
  if (time === 'high') return { kind: 'ACTIVE_RECOVERY', reason: 'low-energy-high-time' };
  return { kind: 'CHOICE', options: ['ACTIVE_RECOVERY_WALK', 'REST'] };
}

export function decideTrainingMode(checkIn: DailyCheckIn): TrainingDecision {
  const pain = maxPainLevel(checkIn);
  if (pain === 'severe') return { kind: 'ACTIVE_RECOVERY', reason: 'severe-pain' };
  if (pain === 'moderate') return { kind: 'DELOAD' };

  return decideForEnergyAndTime(checkIn.energy, timeTierFromMinutes(checkIn.availableMinutes));
}
