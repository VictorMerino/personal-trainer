import type { SupabaseClient } from '@supabase/supabase-js';
import { WorkoutPlanSchema, type WorkoutPlan } from '../../domain/workout-plan/workout-plan.schema';
import type { SetLogRecord } from '../../domain/history/set-log-record.schema';
import type {
  NewSetLog,
  RepositoryError,
  RepositoryResult,
  StoredWorkoutPlan,
  WorkoutRepository,
} from '../../domain/repository/workout-repository.port';
import { SetLogRowSchema, WorkoutPlanRowSchema } from './supabase-row.schema';

function fail<T>(kind: RepositoryError['kind'], message: string): RepositoryResult<T> {
  return { ok: false, error: { kind, message } };
}

function logValidationFailure(table: string, issues: unknown): void {
  console.warn('[repository] validation failure', { table, issues });
}

export class SupabaseWorkoutRepository implements WorkoutRepository {
  constructor(private readonly client: SupabaseClient) {}

  async savePlan(userId: string, date: string, plan: WorkoutPlan): Promise<RepositoryResult<StoredWorkoutPlan>> {
    const { data, error } = await this.client
      .from('workout_plans')
      .insert({
        user_id: userId,
        date,
        mode: plan.mode,
        generated_by: plan.generatedBy,
        schema_version: plan.schemaVersion,
        prompt_version: plan.promptVersion,
        plan,
      })
      .select('id, user_id, date, plan')
      .single();

    if (error) return fail('db-error', error.message);
    return this.toStoredPlan(data);
  }

  async getPlan(userId: string, planId: string): Promise<RepositoryResult<StoredWorkoutPlan>> {
    const { data, error } = await this.client
      .from('workout_plans')
      .select('id, user_id, date, plan')
      .eq('id', planId)
      .maybeSingle();

    if (error) return fail('db-error', error.message);
    if (!data) return fail('not-found', `No workout plan with id ${planId}`);
    return this.toStoredPlan(data);
  }

  async deletePlan(userId: string, planId: string): Promise<RepositoryResult<void>> {
    const { error } = await this.client.from('workout_plans').delete().eq('id', planId).eq('user_id', userId);
    if (error) return fail('db-error', error.message);
    return { ok: true, value: undefined };
  }

  async logSet(userId: string, workoutPlanId: string, log: NewSetLog): Promise<RepositoryResult<void>> {
    const { error } = await this.client.from('set_logs').insert({
      user_id: userId,
      workout_plan_id: workoutPlanId,
      exercise_id: log.exerciseId,
      movement_pattern: log.movementPattern,
      set_index: log.setIndex,
      actual_reps: log.actualReps,
      actual_load_kg: log.actualLoadKg,
      actual_seconds: log.actualSeconds,
      actual_rpe: log.actualRpe,
    });

    if (error) return fail('db-error', error.message);
    return { ok: true, value: undefined };
  }

  async getRecentSetLogs(
    userId: string,
    asOf: Date,
    windowDays: number,
  ): Promise<RepositoryResult<readonly SetLogRecord[]>> {
    const windowStart = new Date(asOf.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const { data, error } = await this.client
      .from('set_logs')
      .select('exercise_id, movement_pattern, workout_plan_id, logged_at, set_index, actual_rpe, actual_load_kg, workout_plans(plan)')
      .eq('user_id', userId)
      .gte('logged_at', windowStart.toISOString());

    if (error) return fail('db-error', error.message);

    const records: SetLogRecord[] = [];
    for (const row of data ?? []) {
      const parsed = SetLogRowSchema.safeParse(row);
      if (!parsed.success) {
        logValidationFailure('set_logs', parsed.error.issues);
        continue;
      }

      const record = toSetLogRecord(parsed.data);
      if (record) records.push(record);
    }

    return { ok: true, value: records };
  }

  private toStoredPlan(row: unknown): RepositoryResult<StoredWorkoutPlan> {
    const parsed = WorkoutPlanRowSchema.safeParse(row);
    if (!parsed.success) {
      logValidationFailure('workout_plans', parsed.error.issues);
      return fail('validation-failed', 'Stored workout plan did not match WorkoutPlanSchema');
    }

    return {
      ok: true,
      value: { id: parsed.data.id, userId: parsed.data.user_id, date: parsed.data.date, plan: parsed.data.plan },
    };
  }
}

function toSetLogRecord(row: ReturnType<typeof SetLogRowSchema.parse>): SetLogRecord | null {
  const embedded = Array.isArray(row.workout_plans) ? row.workout_plans[0] : row.workout_plans;
  const plan = embedded ? WorkoutPlanSchema.safeParse(embedded.plan) : undefined;
  if (!plan?.success) return null;

  const targetRpe = findTargetRpe(plan.data, row.exercise_id, row.set_index);
  if (targetRpe === null) return null;

  return {
    exerciseId: row.exercise_id,
    pattern: row.movement_pattern,
    workoutPlanId: row.workout_plan_id,
    loggedAt: new Date(row.logged_at),
    actualRpe: row.actual_rpe,
    targetRpe,
    actualLoadKg: row.actual_load_kg,
  };
}

function findTargetRpe(plan: WorkoutPlan, exerciseId: string, setIndex: number): number | null {
  for (const block of plan.blocks) {
    for (const exercise of block.exercises) {
      if (exercise.exerciseId !== exerciseId) continue;
      return exercise.sets[setIndex]?.rpeTarget ?? null;
    }
  }
  return null;
}
