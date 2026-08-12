// One typed function per backend endpoint the UI calls, so components never
// touch authorizedFetch/response.ok/response.json() directly (previously
// duplicated ad hoc in every component — inconsistent error handling, no
// single place to see "what does the UI call"). Same Result-typed no-throw
// convention already used by WorkoutRepository/WorkoutPlanner
// (docs/adr/0005-workout-planner-port.md decision 1) — a failed call is a
// routine, expected outcome here too, not an exception.
import { authorizedFetch } from '../../../shared/http/authorized-fetch';
import type { BodyZone } from '../domain/exercise/exercise.schema';
import type { LimitationSeverity } from '../domain/limitation.schema';
import type { EquipmentContext, DailyCheckIn } from '../domain/readiness/daily-checkin.schema';
import type { TrainingDecision } from '../domain/readiness/training-decision';
import type { WorkoutPlan } from '../domain/workout-plan/workout-plan.schema';
import type { ProgressRange } from '../domain/progress/progress-range';
import type { ProgressSnapshot } from '../domain/progress/progress-snapshot';
import type { ExperienceLevel } from '../domain/profile/user-profile.schema';
import type { Goal } from '../domain/generator/generator.constants';
import type { StopReason } from '../domain/session/stop-reason.schema';

export type ApiResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly status: number };

async function call<T>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await authorizedFetch(input, init);
  if (!response.ok) return { ok: false, status: response.status };
  return { ok: true, value: (await response.json()) as T };
}

export interface TodayStatus {
  readonly checkInId: string;
  readonly decision: TrainingDecision;
  readonly plan: { readonly id: string; readonly endedAt: string | null } | null;
}

export function getTodayStatus(): Promise<ApiResult<TodayStatus>> {
  return call('/api/checkin', { method: 'GET' });
}

export interface SubmitCheckInResult {
  readonly decision: TrainingDecision;
  readonly checkInId: string;
  readonly planId: string | null;
}

export function submitCheckIn(checkIn: DailyCheckIn): Promise<ApiResult<SubmitCheckInResult>> {
  return call('/api/checkin', { method: 'POST', body: JSON.stringify(checkIn) });
}

export interface ResolveChoiceResult {
  readonly decision: TrainingDecision;
  readonly planId: string | null;
}

export function resolveChoice(
  checkInId: string,
  selection: 'ACTIVE_RECOVERY_WALK' | 'REST',
): Promise<ApiResult<ResolveChoiceResult>> {
  return call(`/api/checkin/${checkInId}/choice`, { method: 'POST', body: JSON.stringify({ selection }) });
}

export interface GeneratedWorkout {
  readonly id: string;
  readonly plan: WorkoutPlan;
}

export function generateWorkout(): Promise<ApiResult<GeneratedWorkout>> {
  return call('/api/workouts/generate', { method: 'POST' });
}

export interface StoredWorkout {
  readonly id: string;
  readonly plan: WorkoutPlan;
  readonly endedAt: string | null;
}

export function getWorkout(planId: string): Promise<ApiResult<StoredWorkout>> {
  return call(`/api/workouts/${planId}`, { method: 'GET' });
}

export interface LogSetInput {
  readonly exerciseId: string;
  readonly setIndex: number;
  readonly actualReps: number | null;
  readonly actualLoadKg: number | null;
  readonly actualSeconds: number | null;
  readonly actualRpe: number;
}

export function logSet(planId: string, input: LogSetInput): Promise<ApiResult<{ ok: true }>> {
  return call(`/api/workouts/${planId}/sets`, { method: 'POST', body: JSON.stringify(input) });
}

export function skipExercise(planId: string, exerciseId: string, reason: StopReason | null): Promise<ApiResult<{ ok: true }>> {
  return call(`/api/workouts/${planId}/skip-exercise`, { method: 'POST', body: JSON.stringify({ exerciseId, reason }) });
}

export function endSession(planId: string, reason: StopReason | null): Promise<ApiResult<{ ok: true; endedAt: string }>> {
  return call(`/api/workouts/${planId}/end`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export interface ProgressResult {
  readonly range: ProgressRange;
  readonly snapshot: ProgressSnapshot;
}

export function getProgress(range: ProgressRange): Promise<ApiResult<ProgressResult>> {
  return call(`/api/progress?range=${range}`, { method: 'GET' });
}

export interface StoredLimitation {
  readonly id: string;
  readonly zone: BodyZone;
  readonly severity: LimitationSeverity;
  readonly isActive: boolean;
}

export interface ProfileResult {
  readonly profile: {
    readonly goal: Goal;
    readonly level: ExperienceLevel;
    readonly defaultEquipmentContext: EquipmentContext;
    readonly dataConsentedAt: string | null;
  };
  readonly limitations: readonly StoredLimitation[];
}

export function getProfile(): Promise<ApiResult<ProfileResult>> {
  return call('/api/profile', { method: 'GET' });
}

export interface SaveProfileInput {
  readonly goal: Goal;
  readonly level: ExperienceLevel;
  readonly defaultEquipmentContext: EquipmentContext;
  // Legal basis for processing this special-category data
  // (docs/adr/0015-health-data-compliance.md) — required, not optional.
  readonly consent: true;
}

export function saveProfile(input: SaveProfileInput): Promise<ApiResult<{ ok: true }>> {
  return call('/api/profile', { method: 'PUT', body: JSON.stringify(input) });
}

export function addLimitation(
  zone: BodyZone,
  severity: LimitationSeverity,
): Promise<ApiResult<{ limitation: StoredLimitation }>> {
  return call('/api/profile/limitations', { method: 'POST', body: JSON.stringify({ zone, severity }) });
}

export function resolveLimitation(id: string): Promise<ApiResult<{ ok: true }>> {
  return call(`/api/profile/limitations/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) });
}
