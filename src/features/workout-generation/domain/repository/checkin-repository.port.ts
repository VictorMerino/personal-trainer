import type { DailyCheckIn } from '../readiness/daily-checkin.schema';
import type { TrainingDecision } from '../readiness/training-decision';
import type { RepositoryResult } from './workout-repository.port';

export interface StoredCheckIn {
  readonly id: string;
  readonly userId: string;
  readonly date: string;
  readonly checkIn: DailyCheckIn;
  readonly decision: TrainingDecision;
}

// Same Result-typed no-throw convention as WorkoutRepository.
export interface CheckInRepository {
  saveCheckIn(userId: string, date: string, checkIn: DailyCheckIn, decision: TrainingDecision): Promise<RepositoryResult<StoredCheckIn>>;
  getCheckIn(userId: string, checkInId: string): Promise<RepositoryResult<StoredCheckIn>>;
  // Resolves a pending CHOICE with the concrete decision it was resolved to.
  resolveChoice(userId: string, checkInId: string, decision: TrainingDecision): Promise<RepositoryResult<StoredCheckIn>>;
}
