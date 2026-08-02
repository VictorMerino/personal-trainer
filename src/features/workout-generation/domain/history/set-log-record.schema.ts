import { z } from 'zod';
import { MovementPattern } from '../exercise/exercise.schema';

// The flat, per-set view buildHistorySummary consumes — one row per logged
// set, already joined against the prescribed rpeTarget it was logged
// against (that join lives in the repository/infrastructure layer, not
// here: SetLog itself only stores the actual value, per ADR-0007).
export const SetLogRecordSchema = z.object({
  exerciseId: z.string().regex(/^[a-z0-9-]+$/),
  // Denormalized at log time, same as the set_logs table (ADR-0007).
  pattern: MovementPattern,
  workoutPlanId: z.string(),
  loggedAt: z.date(),
  actualRpe: z.number().min(0).max(10),
  targetRpe: z.number().min(0).max(10),
  actualLoadKg: z.number().positive().nullable(),
});
export type SetLogRecord = z.infer<typeof SetLogRecordSchema>;
