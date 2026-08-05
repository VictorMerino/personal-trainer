import { z } from 'zod';
import { WorkoutPlanSchema } from '../../domain/workout-plan/workout-plan.schema';
import { MovementPattern } from '../../domain/exercise/exercise.schema';
import { DailyCheckInSchema } from '../../domain/readiness/daily-checkin.schema';
import { TrainingDecisionSchema } from '../../domain/readiness/training-decision';

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

const CheckInPainReportRow = z.object({ zone: z.string(), level: z.string() });

export const DailyCheckInRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  date: z.string(),
  energy: z.string(),
  available_minutes: z.number().int(),
  equipment_context: z.string(),
  decision: TrainingDecisionSchema,
  checkin_pain_reports: z.array(CheckInPainReportRow),
});
export type DailyCheckInRow = z.infer<typeof DailyCheckInRowSchema>;

export function toDailyCheckIn(row: DailyCheckInRow) {
  return DailyCheckInSchema.parse({
    energy: row.energy,
    availableMinutes: row.available_minutes,
    equipmentContext: row.equipment_context,
    painReports: row.checkin_pain_reports.map((r) => ({ zone: r.zone, level: r.level })),
  });
}
