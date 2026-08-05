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
  // POST /api/workouts/generate takes no body — it acts on "today's"
  // check-in, looked up by date rather than an id the client would have to
  // remember (ADR-0011 decision 3).
  getCheckInForDate(userId: string, date: string): Promise<RepositoryResult<StoredCheckIn>>;
  // Resolves a pending CHOICE with the concrete decision it was resolved to.
  resolveChoice(userId: string, checkInId: string, decision: TrainingDecision): Promise<RepositoryResult<StoredCheckIn>>;
}
