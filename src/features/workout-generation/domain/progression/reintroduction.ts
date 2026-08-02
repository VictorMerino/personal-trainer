import { REINTRODUCTION_LOAD_FACTOR } from './progression.constants';

// Conservative restart, not a return to the last known load (ADR-0004 decision 4).
export function reintroductionLoadKg(lastKnownLoadKg: number): number {
  return lastKnownLoadKg * REINTRODUCTION_LOAD_FACTOR;
}
