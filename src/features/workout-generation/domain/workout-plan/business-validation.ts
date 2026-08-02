import type { WorkoutPlan } from './workout-plan.schema';

// ADR-0002 decision 5: a business-rule violation rejects the whole plan —
// never patched or pruned down to the exercises that were valid.
export function isBusinessValid(
  plan: WorkoutPlan,
  permittedExerciseIds: ReadonlySet<string>,
): boolean {
  return plan.blocks.every((block) =>
    block.exercises.every((exercise) => permittedExerciseIds.has(exercise.exerciseId)),
  );
}
