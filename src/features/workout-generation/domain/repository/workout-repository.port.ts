import type { MovementPattern } from '../exercise/exercise.schema';
import type { WorkoutPlan } from '../workout-plan/workout-plan.schema';
import type { SetLogRecord } from '../history/set-log-record.schema';
import type { StopReason } from '../session/stop-reason.schema';

export interface StoredWorkoutPlan {
  readonly id: string;
  readonly userId: string;
  readonly date: string;
  readonly plan: WorkoutPlan;
  // null while in progress (ADR-0009 decision 2).
  readonly endedAt: string | null;
}

export interface NewSetLog {
  readonly exerciseId: string;
  readonly movementPattern: MovementPattern;
  readonly setIndex: number;
  readonly actualReps: number | null;
  readonly actualLoadKg: number | null;
  readonly actualSeconds: number | null;
  readonly actualRpe: number;
}

export type RepositoryErrorKind = 'validation-failed' | 'not-found' | 'db-error';

export interface RepositoryError {
  readonly kind: RepositoryErrorKind;
  readonly message: string;
}

export type RepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RepositoryError };

// A single failed call is a routine, expected outcome — Result, never a
// thrown error (same convention as WorkoutPlanner, ADR-0005 decision 1).
export interface WorkoutRepository {
  savePlan(userId: string, date: string, plan: WorkoutPlan): Promise<RepositoryResult<StoredWorkoutPlan>>;
  // Re-validates the stored plan against WorkoutPlanSchema (ADR-0007
  // consequences: a plan valid under an older schema_version must be
  // caught, not silently misinterpreted).
  getPlan(userId: string, planId: string): Promise<RepositoryResult<StoredWorkoutPlan>>;
  // set_logs cascades on delete at the DB level (migration
  // 20260804120000) — no separate cleanup call needed here.
  deletePlan(userId: string, planId: string): Promise<RepositoryResult<void>>;
  // Upserts on (workout_plan_id, exercise_id, set_index) — autosave means
  // the same set can be logged more than once, as a correction (ADR-0008
  // decision 4), not a new row each time.
  logSet(userId: string, workoutPlanId: string, log: NewSetLog): Promise<RepositoryResult<void>>;
  getRecentSetLogs(userId: string, asOf: Date, windowDays: number): Promise<RepositoryResult<readonly SetLogRecord[]>>;
  // Remaining unlogged sets for this exercise are not otherwise represented
  // (ADR-0009 consequences: a skip is the absence of a row, made
  // meaningful by this marker, not a SetLog row of its own).
  skipExercise(userId: string, workoutPlanId: string, exerciseId: string, reason: StopReason | null): Promise<RepositoryResult<void>>;
  endSession(userId: string, workoutPlanId: string, reason: StopReason | null): Promise<RepositoryResult<StoredWorkoutPlan>>;
  // ADR-0010: progress's adherence denominator needs every finalized
  // plan's prescribed-set count in range, even one with zero logged sets
  // at all (which getRecentSetLogs, joined from set_logs, would never
  // surface on its own).
  getFinalizedPlansInRange(userId: string, from: Date, to: Date): Promise<RepositoryResult<readonly WorkoutPlan[]>>;
}
