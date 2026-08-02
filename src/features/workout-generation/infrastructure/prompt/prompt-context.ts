import type { Exercise, MovementPattern } from '../../domain/exercise/exercise.schema';
import type { Goal } from '../../domain/generator/generator.constants';
import type { PerPatternSummary } from '../../domain/history/history-summary';
import type { EquipmentContext } from '../../domain/readiness/daily-checkin.schema';
import type { PlanRequest } from '../../domain/planner/workout-planner.port';
import type { TrainingDecision } from '../../domain/readiness/training-decision';

// Tracked independently from WorkoutPlanSchema.schemaVersion (ADR-0006 decision 1):
// this counts prompt wording/format changes, not stored-data shape changes.
export const PROMPT_VERSION = 1;

export type ProfileEssentials = Pick<PlanRequest, 'goal' | 'availableMinutes' | 'equipmentContext'>;

export interface CompactExercise {
  readonly id: string;
  readonly name: string;
  readonly pattern: MovementPattern;
  readonly equipment: Exercise['equipment'];
  readonly level: Exercise['level'];
}

export interface PromptContext {
  readonly goal: Goal;
  readonly availableMinutes: number;
  readonly equipmentContext: EquipmentContext;
  readonly decision: TrainingDecision;
  readonly permittedExercises: readonly CompactExercise[];
  // perPattern only — never perExercise or raw SetLog data (ADR-0005 decisions 4-5).
  readonly history: Readonly<Record<MovementPattern, PerPatternSummary>>;
}

function toCompactExercise(exercise: Exercise): CompactExercise {
  return {
    id: exercise.id,
    name: exercise.name,
    pattern: exercise.pattern,
    equipment: exercise.equipment,
    level: exercise.level,
  };
}

export function buildPromptContext(
  profile: ProfileEssentials,
  decision: TrainingDecision,
  permittedExercises: readonly Exercise[],
  history: Readonly<Record<MovementPattern, PerPatternSummary>>,
): PromptContext {
  return {
    goal: profile.goal,
    availableMinutes: profile.availableMinutes,
    equipmentContext: profile.equipmentContext,
    decision,
    permittedExercises: permittedExercises.map(toCompactExercise),
    history,
  };
}
