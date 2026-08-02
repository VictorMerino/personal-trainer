import type { Exercise } from '../exercise/exercise.schema';
import type { Limitation } from '../limitation.schema';
import type { EquipmentContext } from '../readiness/daily-checkin.schema';
import {
  WORKOUT_PLAN_SCHEMA_VERSION,
  type PrescribedExercise,
  type WorkoutPlan,
} from '../workout-plan/workout-plan.schema';
import { ACTIVE_RECOVERY_RPE_TARGET, type Goal } from './generator.constants';
import { selectExerciseForPattern } from './exercise-rotation';
import { selectPatternsForSession } from './pattern-selection';
import { buildSetsForExercise } from './set-sizing';

export interface DeterministicGeneratorInput {
  readonly catalog: readonly Exercise[];
  readonly mode: 'NORMAL' | 'DELOAD' | 'ACTIVE_RECOVERY';
  readonly goal: Goal;
  readonly availableMinutes: number;
  readonly equipmentContext: EquipmentContext;
  readonly effectiveLimitations: readonly Limitation[];
  readonly lastUsedByExerciseId: ReadonlyMap<string, Date>;
  readonly currentLoadKgByExerciseId: ReadonlyMap<string, number>;
  // Per-exercise RPE cap from progression (stall-backoff or reintroduction,
  // ADR-0004) — optional, since most exercises carry no active cap.
  readonly rpeTargetCapByExerciseId?: ReadonlyMap<string, number>;
}

const ACTIVE_RECOVERY_PATTERN = 'locomotion';

function buildActiveRecoveryPlan(input: DeterministicGeneratorInput): WorkoutPlan {
  const exercise = selectExerciseForPattern(
    input.catalog,
    ACTIVE_RECOVERY_PATTERN,
    input.equipmentContext,
    input.effectiveLimitations,
    input.lastUsedByExerciseId,
  );

  if (!exercise) {
    return { mode: 'ACTIVE_RECOVERY', blocks: [], generatedBy: 'deterministic', schemaVersion: WORKOUT_PLAN_SCHEMA_VERSION, promptVersion: null };
  }

  const seconds = Math.round((exercise.defaultRepRange.min + exercise.defaultRepRange.max) / 2);

  return {
    mode: 'ACTIVE_RECOVERY',
    blocks: [
      {
        role: 'main',
        exercises: [
          {
            exerciseId: exercise.id,
            sets: [{ kind: 'time', seconds, rpeTarget: ACTIVE_RECOVERY_RPE_TARGET }],
          },
        ],
      },
    ],
    generatedBy: 'deterministic',
    schemaVersion: WORKOUT_PLAN_SCHEMA_VERSION,
    promptVersion: null,
  };
}

function buildTrainingPlan(input: DeterministicGeneratorInput, mode: 'NORMAL' | 'DELOAD'): WorkoutPlan {
  const patterns = selectPatternsForSession(input.availableMinutes);

  const exercises: PrescribedExercise[] = patterns
    .map((pattern) =>
      selectExerciseForPattern(
        input.catalog,
        pattern,
        input.equipmentContext,
        input.effectiveLimitations,
        input.lastUsedByExerciseId,
      ),
    )
    .filter((exercise): exercise is Exercise => exercise !== undefined)
    .map((exercise) => ({
      exerciseId: exercise.id,
      sets: buildSetsForExercise(
        exercise,
        input.goal,
        mode,
        input.currentLoadKgByExerciseId,
        input.rpeTargetCapByExerciseId?.get(exercise.id),
      ),
    }));

  return {
    mode,
    blocks: exercises.length > 0 ? [{ role: 'main', exercises }] : [],
    generatedBy: 'deterministic',
    schemaVersion: WORKOUT_PLAN_SCHEMA_VERSION,
    promptVersion: null,
  };
}

// The last, network-free link in the fallback chain (docs/PROJECT-BRIEF.md §7) — always succeeds.
export function generateDeterministicPlan(input: DeterministicGeneratorInput): WorkoutPlan {
  if (input.mode === 'ACTIVE_RECOVERY') return buildActiveRecoveryPlan(input);
  return buildTrainingPlan(input, input.mode);
}
