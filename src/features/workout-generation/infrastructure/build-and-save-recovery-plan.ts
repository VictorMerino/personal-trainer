import { EXERCISE_CATALOG } from '../domain/exercise/catalog';
import { generateDeterministicPlan } from '../domain/generator/deterministic-generator';
import { buildHistorySummary, RECENT_HISTORY_WINDOW_DAYS } from '../domain/history/history-summary';
import type { EquipmentContext } from '../domain/readiness/daily-checkin.schema';
import type { Limitation } from '../domain/limitation.schema';
import { WORKOUT_PLAN_SCHEMA_VERSION, type WorkoutPlan } from '../domain/workout-plan/workout-plan.schema';
import type { RepositoryResult, StoredWorkoutPlan, WorkoutRepository } from '../domain/repository/workout-repository.port';

// The empty plan created for a REST resolution of a CHOICE (ADR-0011
// decision 4) — no generator call is needed, there is nothing to prescribe.
export const REST_PLAN: WorkoutPlan = {
  mode: 'ACTIVE_RECOVERY',
  blocks: [],
  generatedBy: 'deterministic',
  schemaVersion: WORKOUT_PLAN_SCHEMA_VERSION,
  promptVersion: null,
};

// Shared by both the direct severe-pain/low-energy ACTIVE_RECOVERY path
// (POST /api/checkin) and the CHOICE -> ACTIVE_RECOVERY_WALK resolution
// (POST /api/checkin/:id/choice) — same minimal plan shape either way
// (ADR-0011 decisions 2 and "Resolving CHOICE to ACTIVE_RECOVERY_WALK...").
export async function buildAndSaveActiveRecoveryPlan(
  workoutRepository: WorkoutRepository,
  userId: string,
  date: string,
  equipmentContext: EquipmentContext,
  effectiveLimitations: readonly Limitation[],
): Promise<RepositoryResult<StoredWorkoutPlan>> {
  const plan = generateDeterministicPlan({
    catalog: EXERCISE_CATALOG,
    mode: 'ACTIVE_RECOVERY',
    goal: 'general_fitness',
    availableMinutes: 20,
    equipmentContext,
    effectiveLimitations,
    lastUsedByExerciseId: await lastUsedByExerciseId(workoutRepository, userId),
    currentLoadKgByExerciseId: new Map(),
  });

  return workoutRepository.savePlan(userId, date, plan);
}

export async function saveRestPlan(
  workoutRepository: WorkoutRepository,
  userId: string,
  date: string,
): Promise<RepositoryResult<StoredWorkoutPlan>> {
  return workoutRepository.savePlan(userId, date, REST_PLAN);
}

async function lastUsedByExerciseId(workoutRepository: WorkoutRepository, userId: string): Promise<ReadonlyMap<string, Date>> {
  const result = await workoutRepository.getRecentSetLogs(userId, new Date(), RECENT_HISTORY_WINDOW_DAYS);
  if (!result.ok) return new Map();

  const summary = buildHistorySummary(result.value, new Date());
  const map = new Map<string, Date>();
  for (const [exerciseId, perExercise] of Object.entries(summary.perExercise)) {
    if (perExercise.lastUsedAt) map.set(exerciseId, perExercise.lastUsedAt);
  }
  return map;
}
