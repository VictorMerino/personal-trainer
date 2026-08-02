import { nextLoad } from './next-load';
import { STALL_SESSIONS_THRESHOLD } from './progression.constants';

export interface ExerciseSessionRecord {
  readonly loadKg: number;
  readonly avgActualRpe: number;
  readonly targetRpe: number;
}

function didLoadIncrease(record: ExerciseSessionRecord): boolean {
  return nextLoad(record.loadKg, record.avgActualRpe, record.targetRpe) > record.loadKg;
}

// sessionsMostRecentFirst: this exercise's session history, newest first.
export function hasStalled(sessionsMostRecentFirst: readonly ExerciseSessionRecord[]): boolean {
  if (sessionsMostRecentFirst.length < STALL_SESSIONS_THRESHOLD) return false;

  return sessionsMostRecentFirst.slice(0, STALL_SESSIONS_THRESHOLD).every((record) => !didLoadIncrease(record));
}
