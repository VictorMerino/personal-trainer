import { z } from 'zod';
import { WorkoutPlanSchema } from '../../domain/workout-plan/workout-plan.schema';
import { MovementPattern } from '../../domain/exercise/exercise.schema';

export const WorkoutPlanRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  date: z.string(),
  plan: WorkoutPlanSchema,
});
export type WorkoutPlanRow = z.infer<typeof WorkoutPlanRowSchema>;

// The embedded `workout_plans` row comes back as an array from PostgREST's
// nested-select even though the FK makes it one-to-one.
const EmbeddedPlan = z.object({ plan: WorkoutPlanSchema });
export const SetLogRowSchema = z.object({
  exercise_id: z.string(),
  movement_pattern: MovementPattern,
  workout_plan_id: z.string(),
  logged_at: z.string(),
  set_index: z.number().int(),
  actual_rpe: z.number(),
  actual_load_kg: z.number().nullable(),
  workout_plans: z.union([EmbeddedPlan, z.array(EmbeddedPlan)]).nullable(),
});
export type SetLogRow = z.infer<typeof SetLogRowSchema>;
