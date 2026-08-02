import { nextLoad } from '../progression/next-load';
import { MovementPattern } from '../exercise/exercise.schema';
import type { SetLogRecord } from './set-log-record.schema';

// The one place "recent window" is defined (ADR-0005 consequences).
export const RECENT_HISTORY_WINDOW_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PerExerciseSummary {
  readonly lastUsedAt: Date | null;
  readonly currentLoadKg: number | null;
  readonly stallCounter: number;
}

export interface PerPatternSummary {
  readonly daysSinceTrained: number | null;
  readonly recentMeanRpe: number | null;
  readonly volume: number;
}

export interface HistorySummary {
  readonly perExercise: Readonly<Record<string, PerExerciseSummary>>;
  readonly perPattern: Readonly<Record<MovementPattern, PerPatternSummary>>;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

interface ExerciseSession {
  readonly loadKg: number;
  readonly avgActualRpe: number;
  readonly targetRpe: number;
  readonly sessionLoggedAt: Date;
}

function toSessionsMostRecentFirst(records: readonly SetLogRecord[]): ExerciseSession[] {
  const byPlan = new Map<string, SetLogRecord[]>();
  for (const record of records) {
    const sets = byPlan.get(record.workoutPlanId) ?? [];
    sets.push(record);
    byPlan.set(record.workoutPlanId, sets);
  }

  const sessions = [...byPlan.values()].map((setsInSession) => {
    const loadValues = setsInSession
      .map((s) => s.actualLoadKg)
      .filter((value): value is number => value !== null);

    return {
      loadKg: loadValues.length > 0 ? mean(loadValues) : 0,
      avgActualRpe: mean(setsInSession.map((s) => s.actualRpe)),
      targetRpe: mean(setsInSession.map((s) => s.targetRpe)),
      sessionLoggedAt: setsInSession.reduce(
        (latest, s) => (s.loggedAt > latest ? s.loggedAt : latest),
        setsInSession[0].loggedAt,
      ),
    };
  });

  return sessions.sort((a, b) => b.sessionLoggedAt.getTime() - a.sessionLoggedAt.getTime());
}

// Counts consecutive sessions, most recent first, where nextLoad() never
// fired its undershoot/increase branch (ADR-0004 decision 3's raw material).
function countConsecutiveNonIncreasingSessions(sessions: readonly ExerciseSession[]): number {
  let count = 0;
  for (const session of sessions) {
    const increased = nextLoad(session.loadKg, session.avgActualRpe, session.targetRpe) > session.loadKg;
    if (increased) break;
    count++;
  }
  return count;
}

function buildPerExercise(records: readonly SetLogRecord[]): Record<string, PerExerciseSummary> {
  const byExercise = new Map<string, SetLogRecord[]>();
  for (const record of records) {
    const list = byExercise.get(record.exerciseId) ?? [];
    list.push(record);
    byExercise.set(record.exerciseId, list);
  }

  const result: Record<string, PerExerciseSummary> = {};
  for (const [exerciseId, exerciseRecords] of byExercise) {
    const mostRecent = exerciseRecords.reduce((latest, r) => (r.loggedAt > latest.loggedAt ? r : latest));
    const hasLoadData = exerciseRecords.some((r) => r.actualLoadKg !== null);
    const sessions = toSessionsMostRecentFirst(exerciseRecords);

    result[exerciseId] = {
      lastUsedAt: mostRecent.loggedAt,
      currentLoadKg: mostRecent.actualLoadKg,
      stallCounter: hasLoadData ? countConsecutiveNonIncreasingSessions(sessions) : 0,
    };
  }
  return result;
}

function buildPerPattern(
  records: readonly SetLogRecord[],
  asOf: Date,
  windowStart: Date,
): Record<MovementPattern, PerPatternSummary> {
  const result = {} as Record<MovementPattern, PerPatternSummary>;

  for (const pattern of MovementPattern.options) {
    const patternRecords = records.filter((r) => r.pattern === pattern);
    if (patternRecords.length === 0) {
      result[pattern] = { daysSinceTrained: null, recentMeanRpe: null, volume: 0 };
      continue;
    }

    const mostRecent = patternRecords.reduce((latest, r) => (r.loggedAt > latest.loggedAt ? r : latest));
    const windowed = patternRecords.filter((r) => r.loggedAt >= windowStart);

    result[pattern] = {
      daysSinceTrained: daysBetween(asOf, mostRecent.loggedAt),
      recentMeanRpe: windowed.length > 0 ? mean(windowed.map((r) => r.actualRpe)) : null,
      volume: windowed.length,
    };
  }

  return result;
}

// Computed once from SetLog history, read two ways: the deterministic
// generator reads perExercise directly, the LLM prompt serializes only
// perPattern (ADR-0005 decision 4).
export function buildHistorySummary(
  records: readonly SetLogRecord[],
  asOf: Date,
  windowDays: number = RECENT_HISTORY_WINDOW_DAYS,
): HistorySummary {
  const windowStart = new Date(asOf.getTime() - windowDays * MS_PER_DAY);
  return {
    perExercise: buildPerExercise(records),
    perPattern: buildPerPattern(records, asOf, windowStart),
  };
}
