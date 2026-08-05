import type { PrescribedExercise, WorkoutPlan } from '../../../../features/workout-generation/domain/workout-plan/workout-plan.schema';

export function findPrescribedExercise(plan: WorkoutPlan, exerciseId: string): PrescribedExercise | undefined {
  for (const block of plan.blocks) {
    const exercise = block.exercises.find((e) => e.exerciseId === exerciseId);
    if (exercise) return exercise;
  }
  return undefined;
}
