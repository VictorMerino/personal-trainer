import { reintroductionLoadKg } from './reintroduction';
import { hasStalled, type ExerciseSessionRecord } from './stall-detection';
import { REINTRODUCTION_RPE_CAP, STALL_BACKOFF_RPE_TARGET } from './progression.constants';

export interface ProgressionState {
  // Current working load — already reflects the most recent nextLoad() call,
  // or a first-prescription default if this exercise has no history yet.
  readonly currentLoadKg: number;
  // This exercise's session history, newest first.
  readonly recentSessions: readonly ExerciseSessionRecord[];
  // True only for the first session after this exercise's limitation-driven
  // exclusion was resolved.
  readonly justReintroduced: boolean;
}

export interface EffectivePrescription {
  readonly loadKg: number;
  // Present only when a stall-backoff or reintroduction cap applies —
  // independent of, and composable with, the session-level DELOAD cap.
  readonly rpeTargetCap?: number;
}

// Layers reintroduction, stall-backoff and ordinary autoregulation into one
// per-exercise prescription (ADR-0004) — deliberately not part of
// TrainingDecision (ADR-0004 decision 1).
export function computeEffectivePrescription(state: ProgressionState): EffectivePrescription {
  if (state.justReintroduced) {
    return { loadKg: reintroductionLoadKg(state.currentLoadKg), rpeTargetCap: REINTRODUCTION_RPE_CAP };
  }
  if (hasStalled(state.recentSessions)) {
    return { loadKg: state.currentLoadKg, rpeTargetCap: STALL_BACKOFF_RPE_TARGET };
  }
  return { loadKg: state.currentLoadKg };
}
