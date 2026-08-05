import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { UserProfileSchema, type UserProfile } from '../../domain/profile/user-profile.schema';
import { LimitationSchema } from '../../domain/limitation.schema';
import type { BodyZone } from '../../domain/exercise/exercise.schema';
import type { LimitationSeverity } from '../../domain/limitation.schema';
import type {
  LimitationStatus,
  ProfileRepository,
  StoredLimitation,
} from '../../domain/repository/profile-repository.port';
import type { RepositoryError, RepositoryResult } from '../../domain/repository/workout-repository.port';

function fail<T>(kind: RepositoryError['kind'], message: string): RepositoryResult<T> {
  return { ok: false, error: { kind, message } };
}

function logValidationFailure(table: string, issues: unknown): void {
  console.warn('[repository] validation failure', { table, issues });
}

const LIMITATIONS_TABLE = 'limitations';
const DB_ERROR: RepositoryError['kind'] = 'db-error';
const VALIDATION_FAILED: RepositoryError['kind'] = 'validation-failed';

const UserProfileRowSchema = z.object({
  goal: z.string(),
  level: z.string(),
  default_equipment_context: z.string(),
});

const LimitationRowSchema = z.object({
  id: z.string(),
  zone: z.string(),
  severity: z.string(),
  status: z.string(),
});

function toStoredLimitation(row: z.infer<typeof LimitationRowSchema>): RepositoryResult<StoredLimitation> {
  const parsed = LimitationSchema.safeParse({ zone: row.zone, severity: row.severity, isActive: row.status === 'active' });
  if (!parsed.success) {
    logValidationFailure(LIMITATIONS_TABLE, parsed.error.issues);
    return fail(VALIDATION_FAILED, 'Stored limitation did not match LimitationSchema');
  }
  return { ok: true, value: { id: row.id, zone: parsed.data.zone, severity: parsed.data.severity, isActive: parsed.data.isActive } };
}

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getProfile(userId: string): Promise<RepositoryResult<UserProfile>> {
    const { data, error } = await this.client
      .from('user_profiles')
      .select('goal, level, default_equipment_context')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return fail(DB_ERROR, error.message);
    if (!data) return fail('not-found', `No profile for user ${userId}`);
    return this.toProfile(data);
  }

  async upsertProfile(userId: string, profile: UserProfile): Promise<RepositoryResult<UserProfile>> {
    const { data, error } = await this.client
      .from('user_profiles')
      .upsert(
        { user_id: userId, goal: profile.goal, level: profile.level, default_equipment_context: profile.defaultEquipmentContext },
        { onConflict: 'user_id' },
      )
      .select('goal, level, default_equipment_context')
      .single();

    if (error) return fail(DB_ERROR, error.message);
    return this.toProfile(data);
  }

  async getLimitations(userId: string): Promise<RepositoryResult<readonly StoredLimitation[]>> {
    const { data, error } = await this.client.from(LIMITATIONS_TABLE).select('id, zone, severity, status').eq('user_id', userId);
    if (error) return fail(DB_ERROR, error.message);

    const limitations: StoredLimitation[] = [];
    for (const row of data ?? []) {
      const parsedRow = LimitationRowSchema.safeParse(row);
      if (!parsedRow.success) continue;
      const stored = toStoredLimitation(parsedRow.data);
      if (stored.ok) limitations.push(stored.value);
    }
    return { ok: true, value: limitations };
  }

  async addLimitation(userId: string, zone: BodyZone, severity: LimitationSeverity): Promise<RepositoryResult<StoredLimitation>> {
    const { data, error } = await this.client.rpc('upsert_active_limitation', {
      p_user_id: userId,
      p_zone: zone,
      p_severity: severity,
    });

    if (error) return fail(DB_ERROR, error.message);
    const parsedRow = LimitationRowSchema.safeParse(data);
    if (!parsedRow.success) {
      logValidationFailure(LIMITATIONS_TABLE, parsedRow.error.issues);
      return fail(VALIDATION_FAILED, 'Upserted limitation did not match the expected row shape');
    }
    return toStoredLimitation(parsedRow.data);
  }

  async setLimitationStatus(userId: string, limitationId: string, status: LimitationStatus): Promise<RepositoryResult<StoredLimitation>> {
    const { data, error } = await this.client
      .from(LIMITATIONS_TABLE)
      .update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
      .eq('id', limitationId)
      .eq('user_id', userId)
      .select('id, zone, severity, status')
      .maybeSingle();

    if (error) return fail(DB_ERROR, error.message);
    if (!data) return fail('not-found', `No limitation with id ${limitationId}`);

    const parsedRow = LimitationRowSchema.safeParse(data);
    if (!parsedRow.success) {
      logValidationFailure(LIMITATIONS_TABLE, parsedRow.error.issues);
      return fail(VALIDATION_FAILED, 'Updated limitation did not match the expected row shape');
    }
    return toStoredLimitation(parsedRow.data);
  }

  private toProfile(row: unknown): RepositoryResult<UserProfile> {
    const parsedRow = UserProfileRowSchema.safeParse(row);
    if (!parsedRow.success) {
      logValidationFailure('user_profiles', parsedRow.error.issues);
      return fail(VALIDATION_FAILED, 'Stored row did not match the expected user_profiles shape');
    }

    const parsed = UserProfileSchema.safeParse({
      goal: parsedRow.data.goal,
      level: parsedRow.data.level,
      defaultEquipmentContext: parsedRow.data.default_equipment_context,
    });
    if (!parsed.success) {
      logValidationFailure('user_profiles', parsed.error.issues);
      return fail(VALIDATION_FAILED, 'Stored profile did not match UserProfileSchema');
    }
    return { ok: true, value: parsed.data };
  }
}
