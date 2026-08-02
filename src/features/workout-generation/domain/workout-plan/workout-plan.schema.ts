import { z } from 'zod';
import { SetTargetSchema } from './set-target.schema';

// Ties the persisted shape to the version that produced it (ADR-0002 decision 4).
export const WORKOUT_PLAN_SCHEMA_VERSION = 1;

export const TrainingMode = z.enum(['NORMAL', 'DELOAD', 'ACTIVE_RECOVERY']);
export type TrainingMode = z.infer<typeof TrainingMode>;

export const BlockRole = z.enum(['warmup', 'main', 'accessory', 'cooldown']);
export type BlockRole = z.infer<typeof BlockRole>;

export const GeneratedBy = z.enum(['groq', 'openrouter', 'deterministic']);
export type GeneratedBy = z.infer<typeof GeneratedBy>;

export const PrescribedExerciseSchema = z.object({
  exerciseId: z.string().regex(/^[a-z0-9-]+$/),
  sets: z.array(SetTargetSchema).min(1),
});
export type PrescribedExercise = z.infer<typeof PrescribedExerciseSchema>;

export const WorkoutBlockSchema = z.object({
  role: BlockRole,
  exercises: z.array(PrescribedExerciseSchema).min(1),
});
export type WorkoutBlock = z.infer<typeof WorkoutBlockSchema>;

export const WorkoutPlanSchema = z.object({
  mode: TrainingMode,
  // Empty for a REST resolution of a CHOICE — no exercise was prescribed (ADR-0011).
  blocks: z.array(WorkoutBlockSchema),
  generatedBy: GeneratedBy,
  schemaVersion: z.number().int().positive(),
  // Null for deterministic-generated plans — no prompt was involved.
  promptVersion: z.number().int().positive().nullable(),
});
export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;
