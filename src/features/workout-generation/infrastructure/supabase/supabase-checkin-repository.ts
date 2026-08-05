import type { SupabaseClient } from '@supabase/supabase-js';
import type { DailyCheckIn } from '../../domain/readiness/daily-checkin.schema';
import type { TrainingDecision } from '../../domain/readiness/training-decision';
import type { CheckInRepository, StoredCheckIn } from '../../domain/repository/checkin-repository.port';
import type { RepositoryError, RepositoryResult } from '../../domain/repository/workout-repository.port';
import { DailyCheckInRowSchema, toDailyCheckIn } from './supabase-row.schema';

const CHECKIN_SELECT = 'id, user_id, date, energy, available_minutes, equipment_context, decision, checkin_pain_reports(zone, level)';

function fail<T>(kind: RepositoryError['kind'], message: string): RepositoryResult<T> {
  return { ok: false, error: { kind, message } };
}

function logValidationFailure(table: string, issues: unknown): void {
  console.warn('[repository] validation failure', { table, issues });
}

export class SupabaseCheckInRepository implements CheckInRepository {
  constructor(private readonly client: SupabaseClient) {}

  async saveCheckIn(
    userId: string,
    date: string,
    checkIn: DailyCheckIn,
    decision: TrainingDecision,
  ): Promise<RepositoryResult<StoredCheckIn>> {
    const { data, error } = await this.client
      .from('daily_checkins')
      .insert({
        user_id: userId,
        date,
        energy: checkIn.energy,
        available_minutes: checkIn.availableMinutes,
        equipment_context: checkIn.equipmentContext,
        decision,
      })
      .select('id')
      .single();

    if (error) return fail('db-error', error.message);

    if (checkIn.painReports.length > 0) {
      const { error: painError } = await this.client.from('checkin_pain_reports').insert(
        checkIn.painReports.map((report) => ({
          checkin_id: data.id,
          zone: report.zone,
          level: report.level,
        })),
      );
      if (painError) return fail('db-error', painError.message);
    }

    return this.getCheckIn(userId, data.id);
  }

  async getCheckIn(userId: string, checkInId: string): Promise<RepositoryResult<StoredCheckIn>> {
    const { data, error } = await this.client
      .from('daily_checkins')
      .select(CHECKIN_SELECT)
      .eq('id', checkInId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return fail('db-error', error.message);
    if (!data) return fail('not-found', `No check-in with id ${checkInId}`);
    return this.toStoredCheckIn(data);
  }

  async resolveChoice(userId: string, checkInId: string, decision: TrainingDecision): Promise<RepositoryResult<StoredCheckIn>> {
    const { error } = await this.client
      .from('daily_checkins')
      .update({ decision })
      .eq('id', checkInId)
      .eq('user_id', userId);

    if (error) return fail('db-error', error.message);
    return this.getCheckIn(userId, checkInId);
  }

  private toStoredCheckIn(row: unknown): RepositoryResult<StoredCheckIn> {
    const parsed = DailyCheckInRowSchema.safeParse(row);
    if (!parsed.success) {
      logValidationFailure('daily_checkins', parsed.error.issues);
      return fail('validation-failed', 'Stored check-in did not match DailyCheckInSchema');
    }

    return {
      ok: true,
      value: {
        id: parsed.data.id,
        userId: parsed.data.user_id,
        date: parsed.data.date,
        checkIn: toDailyCheckIn(parsed.data),
        decision: parsed.data.decision,
      },
    };
  }
}
