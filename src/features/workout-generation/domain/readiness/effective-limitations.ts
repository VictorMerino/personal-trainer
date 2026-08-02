import type { BodyZone } from '../exercise/exercise.schema';
import type { Limitation, LimitationSeverity } from '../limitation.schema';
import type { DailyCheckIn, PainLevel } from './daily-checkin.schema';

const SEVERITY_RANK: Record<LimitationSeverity, number> = { mild: 1, moderate: 2, severe: 3 };

function isLimitationSeverity(level: PainLevel): level is LimitationSeverity {
  return level !== 'none';
}

// Recomputed fresh every call from the two inputs (ADR-0001 decision 3) — never persisted, so pain absent from today's check-in never carries forward.
export function effectiveLimitationsForToday(
  profileLimitations: readonly Limitation[],
  checkIn: DailyCheckIn,
): readonly Limitation[] {
  const severityByZone = new Map<BodyZone, LimitationSeverity>();

  for (const limitation of profileLimitations) {
    if (limitation.isActive) severityByZone.set(limitation.zone, limitation.severity);
  }

  for (const report of checkIn.painReports) {
    if (!isLimitationSeverity(report.level)) continue;
    const existing = severityByZone.get(report.zone);
    if (!existing || SEVERITY_RANK[report.level] > SEVERITY_RANK[existing]) {
      severityByZone.set(report.zone, report.level);
    }
  }

  return [...severityByZone.entries()].map(([zone, severity]) => ({
    zone,
    severity,
    isActive: true,
  }));
}
