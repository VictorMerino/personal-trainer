import type { BodyZone } from '../exercise/exercise.schema';
import type { LimitationSeverity } from '../limitation.schema';
import type { UserProfile } from '../profile/user-profile.schema';
import type { RepositoryResult } from './workout-repository.port';

export interface StoredLimitation {
  readonly id: string;
  readonly zone: BodyZone;
  readonly severity: LimitationSeverity;
  readonly isActive: boolean;
}

export type LimitationStatus = 'active' | 'resolved';

// docs/adr/0015-health-data-compliance.md: training/injury data is
// GDPR Art. 9 special-category data — dataConsentedAt is the persisted
// record of the explicit-consent legal basis, not just UI copy.
export interface StoredProfile extends UserProfile {
  readonly dataConsentedAt: string | null;
}

// Same Result-typed no-throw convention as WorkoutRepository/CheckInRepository.
export interface ProfileRepository {
  getProfile(userId: string): Promise<RepositoryResult<StoredProfile>>;
  // consent must be true to save — re-affirmed (dataConsentedAt refreshed)
  // on every save, not just the first one.
  upsertProfile(userId: string, profile: UserProfile, consent: true): Promise<RepositoryResult<StoredProfile>>;
  getLimitations(userId: string): Promise<RepositoryResult<readonly StoredLimitation[]>>;
  // Upserts on (user_id, zone) while status = 'active' (migration
  // 20260807090000) — adding a limitation for an already-limited zone
  // updates the standing severity rather than creating a duplicate row.
  addLimitation(userId: string, zone: BodyZone, severity: LimitationSeverity): Promise<RepositoryResult<StoredLimitation>>;
  setLimitationStatus(userId: string, limitationId: string, status: LimitationStatus): Promise<RepositoryResult<StoredLimitation>>;
}
