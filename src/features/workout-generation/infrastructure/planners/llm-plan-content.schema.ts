import { z } from 'zod';
import {
  BlockRole,
  TrainingMode,
  WORKOUT_PLAN_SCHEMA_VERSION,
  type GeneratedBy,
  type WorkoutPlan,
} from '../../domain/workout-plan/workout-plan.schema';
import { SetTargetSchema } from '../../domain/workout-plan/set-target.schema';

// What we ask an LLM provider to produce: just the part it has an opinion
// about. generatedBy/schemaVersion/promptVersion are metadata the model has
// no reason to know and shouldn't be trusted to echo back correctly.
export const LlmPlanContentSchema = z.object({
  mode: TrainingMode,
  blocks: z.array(
    z.object({
      role: BlockRole,
      exercises: z.array(
        z.object({
          exerciseId: z.string().regex(/^[a-z0-9-]+$/),
          sets: z.array(SetTargetSchema).min(1),
        }),
      ).min(1),
    }),
  ),
});
export type LlmPlanContent = z.infer<typeof LlmPlanContentSchema>;

export function toWorkoutPlan(
  content: LlmPlanContent,
  generatedBy: GeneratedBy,
  promptVersion: number,
): WorkoutPlan {
  return {
    mode: content.mode,
    blocks: content.blocks,
    generatedBy,
    schemaVersion: WORKOUT_PLAN_SCHEMA_VERSION,
    promptVersion,
  };
}
