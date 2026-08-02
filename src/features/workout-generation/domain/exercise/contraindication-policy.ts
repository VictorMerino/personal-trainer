import type { Exercise, StressLevel } from './exercise.schema';
import type { Limitation, LimitationSeverity } from '../limitation.schema';

const MAX_ALLOWED_STRESS: Record<LimitationSeverity, StressLevel> = {
  mild: 'moderate',
  moderate: 'low',
  severe: 'none',
};

const STRESS_RANK: Record<StressLevel, number> = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
};

function stressRank(level: StressLevel): number {
  return STRESS_RANK[level];
}

export function isSuitableFor(
  exercise: Exercise,
  limitations: readonly Limitation[],
): boolean {
  return limitations
    .filter((l) => l.isActive)
    .every((l) => stressRank(exercise.jointStress[l.zone] ?? 'none')
      <= stressRank(MAX_ALLOWED_STRESS[l.severity]));
}
