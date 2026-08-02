import { LOAD_INCREMENT_PCT, RPE_UNDERSHOOT_THRESHOLD } from './progression.constants';

// Undershoot increases load; on-target or overshoot holds it — never an
// automatic decrease (ADR-0004 decision 2).
export function nextLoad(currentLoadKg: number, avgActualRpe: number, targetRpe: number): number {
  if (avgActualRpe <= targetRpe - RPE_UNDERSHOOT_THRESHOLD) {
    return currentLoadKg * (1 + LOAD_INCREMENT_PCT);
  }
  return currentLoadKg;
}
