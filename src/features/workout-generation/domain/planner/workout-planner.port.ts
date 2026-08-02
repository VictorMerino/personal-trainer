import type { Exercise } from '../exercise/exercise.schema';
import type { Goal } from '../generator/generator.constants';
import type { HistorySummary } from '../history/history-summary';
import type { Limitation } from '../limitation.schema';
import type { EquipmentContext } from '../readiness/daily-checkin.schema';
import type { WorkoutPlan } from '../workout-plan/workout-plan.schema';
import type { PlannerError } from './planner-error';

export type PlannerName = 'groq' | 'openrouter' | 'deterministic';

export interface PlanRequest {
  // ACTIVE_RECOVERY is built inline and never reaches a planner (ADR-0011).
  readonly mode: 'NORMAL' | 'DELOAD';
  readonly goal: Goal;
  readonly availableMinutes: number;
  readonly equipmentContext: EquipmentContext;
  readonly effectiveLimitations: readonly Limitation[];
  readonly catalog: readonly Exercise[];
  readonly historySummary: HistorySummary;
}

export type PlannerResult =
  | { readonly ok: true; readonly plan: WorkoutPlan }
  | { readonly ok: false; readonly error: PlannerError };

// A single failed call is a routine, expected outcome — Result, never a
// thrown error (ADR-0005 decision 1).
export interface WorkoutPlanner {
  readonly name: PlannerName;
  tryGenerate(request: PlanRequest): Promise<PlannerResult>;
}
