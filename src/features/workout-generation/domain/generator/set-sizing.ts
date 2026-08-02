import type { Exercise } from '../exercise/exercise.schema';
import type { SetTarget } from '../workout-plan/set-target.schema';
import {
  DEFAULT_STARTING_LOAD_KG,
  DELOAD_RPE_TARGET,
  DELOAD_SET_COUNT_FLOOR,
  NORMAL_RPE_TARGET,
  NORMAL_SET_COUNT,
  REP_RANGE_BY_GOAL,
  type Goal,
} from './generator.constants';

type SizingMode = 'NORMAL' | 'DELOAD';

function buildSingleSet(
  exercise: Exercise,
  goal: Goal,
  rpeTarget: number,
  currentLoadKgByExerciseId: ReadonlyMap<string, number>,
): SetTarget {
  const reps = REP_RANGE_BY_GOAL[goal];

  if (exercise.progression === 'load') {
    const loadKg = currentLoadKgByExerciseId.get(exercise.id) ?? DEFAULT_STARTING_LOAD_KG;
    return { kind: 'load', reps, loadKg, rpeTarget };
  }
  if (exercise.progression === 'reps') {
    return { kind: 'reps', reps, rpeTarget };
  }
  const seconds = Math.round((exercise.defaultRepRange.min + exercise.defaultRepRange.max) / 2);
  return { kind: 'time', seconds, rpeTarget };
}

// Goal sets the rep range; DELOAD caps RPE and drops one set with a floor —
// it never changes which exercise was selected (ADR-0003 decision 3).
export function buildSetsForExercise(
  exercise: Exercise,
  goal: Goal,
  mode: SizingMode,
  currentLoadKgByExerciseId: ReadonlyMap<string, number>,
): SetTarget[] {
  const setCount =
    mode === 'DELOAD' ? Math.max(NORMAL_SET_COUNT - 1, DELOAD_SET_COUNT_FLOOR) : NORMAL_SET_COUNT;
  const rpeTarget = mode === 'DELOAD' ? DELOAD_RPE_TARGET : NORMAL_RPE_TARGET;

  return Array.from({ length: setCount }, () =>
    buildSingleSet(exercise, goal, rpeTarget, currentLoadKgByExerciseId),
  );
}
