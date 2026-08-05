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
import type { StopReason } from '../../domain/session/stop-reason.schema';
import { SetLogRowSchema, WorkoutPlanRowSchema } from './supabase-row.schema';

function fail<T>(kind: RepositoryError['kind'], message: string): RepositoryResult<T> {
  return { ok: false, error: { kind, message } };
}

function logValidationFailure(table: string, issues: unknown): void {
  console.warn('[repository] validation failure', { table, issues });
}

const WORKOUT_PLAN_SELECT = 'id, user_id, date, plan, ended_at';

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
      .select(WORKOUT_PLAN_SELECT)
      .single();

    if (error) return fail('db-error', error.message);
    return this.toStoredPlan(data);
  }

  async getPlan(userId: string, planId: string): Promise<RepositoryResult<StoredWorkoutPlan>> {
    // Filtered by user_id here too, not just RLS — a service-role client
    // (e.g. scripts/seed-demo-data.ts) bypasses RLS entirely, so this
    // repository must not rely on it alone to keep getPlan user-scoped.
    const { data, error } = await this.client
      .from('workout_plans')
      .select(WORKOUT_PLAN_SELECT)
      .eq('id', planId)
      .eq('user_id', userId)
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
    const { error } = await this.client.from('set_logs').upsert(
      {
        user_id: userId,
        workout_plan_id: workoutPlanId,
        exercise_id: log.exerciseId,
        movement_pattern: log.movementPattern,
        set_index: log.setIndex,
        actual_reps: log.actualReps,
        actual_load_kg: log.actualLoadKg,
        actual_seconds: log.actualSeconds,
        actual_rpe: log.actualRpe,
      },
      { onConflict: 'workout_plan_id,exercise_id,set_index' },
    );

    if (error) return fail('db-error', error.message);
    return { ok: true, value: undefined };
  }

  async skipExercise(
    userId: string,
    workoutPlanId: string,
    exerciseId: string,
    reason: StopReason | null,
  ): Promise<RepositoryResult<void>> {
    const owned = await this.getPlan(userId, workoutPlanId);
    if (!owned.ok) return owned;

    const { error } = await this.client
      .from('skipped_exercises')
      .upsert({ workout_plan_id: workoutPlanId, exercise_id: exerciseId, reason }, { onConflict: 'workout_plan_id,exercise_id' });

    if (error) return fail('db-error', error.message);
    return { ok: true, value: undefined };
  }

  async endSession(userId: string, workoutPlanId: string, reason: StopReason | null): Promise<RepositoryResult<StoredWorkoutPlan>> {
    const { data, error } = await this.client
      .from('workout_plans')
      .update({ ended_at: new Date().toISOString(), ended_reason: reason })
      .eq('id', workoutPlanId)
      .eq('user_id', userId)
      .select(WORKOUT_PLAN_SELECT)
      .maybeSingle();

    if (error) return fail('db-error', error.message);
    if (!data) return fail('not-found', `No workout plan with id ${workoutPlanId}`);
    return this.toStoredPlan(data);
  }

  async getRecentSetLogs(
    userId: string,
    asOf: Date,
    windowDays: number,
  ): Promise<RepositoryResult<readonly SetLogRecord[]>> {
    const windowStart = new Date(asOf.getTime() - windowDays * 24 * 60 * 60 * 1000);

    // Only finalized sessions count (ADR-0009 consequences): an
    // in-progress session's sets shouldn't be read as "trained" yet.
    const { data, error } = await this.client
      .from('set_logs')
      .select('exercise_id, movement_pattern, workout_plan_id, logged_at, set_index, actual_rpe, actual_load_kg, workout_plans!inner(plan, ended_at)')
      .eq('user_id', userId)
      .gte('logged_at', windowStart.toISOString())
      .not('workout_plans.ended_at', 'is', null);

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

  async getFinalizedPlansInRange(userId: string, from: Date, to: Date): Promise<RepositoryResult<readonly WorkoutPlan[]>> {
    const { data, error } = await this.client
      .from('workout_plans')
      .select('plan')
      .eq('user_id', userId)
      .not('ended_at', 'is', null)
      .gte('date', from.toISOString().slice(0, 10))
      .lte('date', to.toISOString().slice(0, 10));

    if (error) return fail('db-error', error.message);

    const plans: WorkoutPlan[] = [];
    for (const row of data ?? []) {
      const parsed = WorkoutPlanSchema.safeParse((row as { plan: unknown }).plan);
      if (!parsed.success) {
        logValidationFailure('workout_plans', parsed.error.issues);
        continue;
      }
      plans.push(parsed.data);
    }

    return { ok: true, value: plans };
  }

  private toStoredPlan(row: unknown): RepositoryResult<StoredWorkoutPlan> {
    const parsed = WorkoutPlanRowSchema.safeParse(row);
    if (!parsed.success) {
      logValidationFailure('workout_plans', parsed.error.issues);
      return fail('validation-failed', 'Stored workout plan did not match WorkoutPlanSchema');
    }

    return {
      ok: true,
      value: {
        id: parsed.data.id,
        userId: parsed.data.user_id,
        date: parsed.data.date,
        plan: parsed.data.plan,
        endedAt: parsed.data.ended_at,
      },
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
