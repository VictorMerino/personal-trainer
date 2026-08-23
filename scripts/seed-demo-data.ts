#!/usr/bin/env node
// Populates a demo account with realistic history (docs/PROJECT-BRIEF.md §9):
// "A fresh account starts as an empty app... ship a seed script that
// populates the account with 3-4 weeks of realistic history: logged
// sessions, varied RPE, adherence and volume trend, and at least one day
// where pain forced active recovery." Also serves as the "reset my demo
// data" path via --reset.
//
// Runs real domain logic day-by-day (decideTrainingMode,
// effectiveLimitationsForToday, generateDeterministicPlan, nextLoad) so the
// seeded data is exactly the shape the app itself would have produced, not
// hand-faked rows.
//
// Usage:
//   node --env-file=.env scripts/seed-demo-data.ts --email=demo@example.com [--reset]
//
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — the privileged key that
// bypasses RLS, required since this writes on behalf of an arbitrary user
// without that user's own session/JWT. Use the dashboard's Secret API key
// (sb_secret_...) here, not the legacy service_role JWT — same privilege,
// current naming (Project Settings → API). Never printed, never logged.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { EXERCISE_CATALOG } from '../src/features/workout-generation/domain/exercise/catalog.ts';
import type { Limitation } from '../src/features/workout-generation/domain/limitation.schema.ts';
import { effectiveLimitationsForToday } from '../src/features/workout-generation/domain/readiness/effective-limitations.ts';
import { decideTrainingMode } from '../src/features/workout-generation/domain/readiness/training-decision.ts';
import type { DailyCheckIn } from '../src/features/workout-generation/domain/readiness/daily-checkin.schema.ts';
import { generateDeterministicPlan } from '../src/features/workout-generation/domain/generator/deterministic-generator.ts';
import { nextLoad } from '../src/features/workout-generation/domain/progression/next-load.ts';
import type { WorkoutPlan } from '../src/features/workout-generation/domain/workout-plan/workout-plan.schema.ts';
import { SupabaseWorkoutRepository } from '../src/features/workout-generation/infrastructure/supabase/supabase-workout-repository.ts';

const DEMO_GOAL = 'hypertrophy';
const DEMO_EQUIPMENT = 'basic';
const HISTORY_DAYS = 24;
const REST_DAY_INTERVAL = 3; // train roughly 2 days on, 1 off
const PAIN_DAY_INDEX = 15; // one severe-knee day forcing ACTIVE_RECOVERY

function parseArgs(argv: readonly string[]): { email: string; reset: boolean } {
  const emailArg = argv.find((a) => a.startsWith('--email='));
  if (!emailArg) {
    throw new Error('Usage: seed-demo-data.ts --email=<demo-account-email> [--reset]');
  }
  return { email: emailArg.slice('--email='.length), reset: argv.includes('--reset') };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set (Secret API / service role key, not the anon key)`);
  return value;
}

async function resolveUserId(admin: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Could not list users: ${error.message}`);
  const user = data.users.find((u) => u.email === email);
  if (!user) {
    throw new Error(`No account with email ${email} — accounts are created manually, create one first`);
  }
  return user.id;
}

async function resetDemoData(admin: SupabaseClient, userId: string): Promise<void> {
  // workout_plans -> set_logs cascades (migration 20260804120000);
  // daily_checkins -> checkin_pain_reports cascades (on delete cascade FK).
  await admin.from('workout_plans').delete().eq('user_id', userId);
  await admin.from('daily_checkins').delete().eq('user_id', userId);
  await admin.from('generation_quota').delete().eq('user_id', userId);
  await admin.from('limitations').delete().eq('user_id', userId);
}

async function ensureProfile(admin: SupabaseClient, userId: string): Promise<Limitation[]> {
  await admin.from('user_profiles').upsert({
    user_id: userId,
    goal: DEMO_GOAL,
    level: 'intermediate',
    default_equipment_context: DEMO_EQUIPMENT,
    data_consent_at: new Date().toISOString(),
  });

  // One standing, mild limitation — exercised through effectiveLimitationsForToday
  // alongside the acute severe-knee day, not a substitute for it.
  const { error } = await admin.from('limitations').insert({
    user_id: userId,
    zone: 'shoulder',
    severity: 'mild',
    status: 'active',
  });
  if (error) throw new Error(`Could not seed limitations: ${error.message}`);

  return [{ zone: 'shoulder', severity: 'mild', isActive: true }];
}

function buildCheckIn(dayIndex: number): DailyCheckIn {
  if (dayIndex === PAIN_DAY_INDEX) {
    return {
      energy: 'medium',
      painReports: [{ zone: 'knee', level: 'severe' }],
      availableMinutes: 45,
      equipmentContext: DEMO_EQUIPMENT,
    };
  }

  const availableMinutes = [30, 45, 60][dayIndex % 3];
  return { energy: trendingEnergy(dayIndex), painReports: [], availableMinutes, equipmentContext: DEMO_EQUIPMENT };
}

// Energy trends up over the window (adherence/effort improving), with
// occasional low-energy days for realism.
function trendingEnergy(dayIndex: number): DailyCheckIn['energy'] {
  if (dayIndex % 7 === 0) return 'low';
  if (dayIndex <= HISTORY_DAYS / 2) return 'medium';
  return 'high';
}

// Demo data only — not used for anything security-sensitive.
function jitter(base: number, spread: number): number {
  // eslint-disable-next-line sonarjs/pseudo-random
  return base + (Math.random() * 2 - 1) * spread;
}

function clampRpe(value: number): number {
  return Math.min(10, Math.max(0, Math.round(value * 10) / 10));
}

interface SessionState {
  readonly lastUsedByExerciseId: Map<string, Date>;
  readonly currentLoadKgByExerciseId: Map<string, number>;
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function logExerciseSets(
  repository: SupabaseWorkoutRepository,
  userId: string,
  planId: string,
  exercise: WorkoutPlan['blocks'][number]['exercises'][number],
): Promise<{ actualRpes: number[]; targetRpes: number[] }> {
  const actualRpes: number[] = [];
  const targetRpes: number[] = [];

  for (const [setIndex, set] of exercise.sets.entries()) {
    // Undershoot most sessions (drives real progression via nextLoad),
    // occasionally overshoot — that's the "varied RPE" the brief asks for.
    const actualRpe = clampRpe(jitter(set.rpeTarget - 1, 1.2));
    actualRpes.push(actualRpe);
    targetRpes.push(set.rpeTarget);

    await repository.logSet(userId, planId, {
      exerciseId: exercise.exerciseId,
      movementPattern: findPattern(exercise.exerciseId),
      setIndex,
      actualReps: set.kind !== 'time' ? Math.round(jitter((set.reps.min + set.reps.max) / 2, 1)) : null,
      actualLoadKg: set.kind === 'load' ? Math.round(jitter(set.loadKg, 1) * 10) / 10 : null,
      actualSeconds: set.kind === 'time' ? set.seconds : null,
      actualRpe,
    });
  }

  return { actualRpes, targetRpes };
}

function updateProgressionState(
  exercise: WorkoutPlan['blocks'][number]['exercises'][number],
  actualRpes: readonly number[],
  targetRpes: readonly number[],
  state: SessionState,
): void {
  const currentLoad = state.currentLoadKgByExerciseId.get(exercise.exerciseId);
  if (currentLoad !== undefined) {
    state.currentLoadKgByExerciseId.set(
      exercise.exerciseId,
      nextLoad(currentLoad, mean(actualRpes), mean(targetRpes)),
    );
  } else if (exercise.sets[0]?.kind === 'load') {
    state.currentLoadKgByExerciseId.set(exercise.exerciseId, exercise.sets[0].loadKg);
  }
}

async function logSession(
  repository: SupabaseWorkoutRepository,
  userId: string,
  planId: string,
  plan: WorkoutPlan,
  date: Date,
  state: SessionState,
): Promise<void> {
  for (const block of plan.blocks) {
    for (const exercise of block.exercises) {
      const { actualRpes, targetRpes } = await logExerciseSets(repository, userId, planId, exercise);
      state.lastUsedByExerciseId.set(exercise.exerciseId, date);
      updateProgressionState(exercise, actualRpes, targetRpes, state);
    }
  }
}

function findPattern(exerciseId: string) {
  const exercise = EXERCISE_CATALOG.find((e) => e.id === exerciseId);
  if (!exercise) throw new Error(`Unknown exercise id in generated plan: ${exerciseId}`);
  return exercise.pattern;
}

async function seed(admin: SupabaseClient, userId: string): Promise<void> {
  const profileLimitations = await ensureProfile(admin, userId);
  const repository = new SupabaseWorkoutRepository(admin);
  const state: SessionState = { lastUsedByExerciseId: new Map(), currentLoadKgByExerciseId: new Map() };

  const today = new Date();
  let sessionsLogged = 0;

  for (let dayIndex = HISTORY_DAYS; dayIndex >= 1; dayIndex--) {
    if (dayIndex !== PAIN_DAY_INDEX && dayIndex % REST_DAY_INTERVAL === 0) continue; // adherence trend, not every day trained

    const date = new Date(today.getTime() - dayIndex * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().slice(0, 10);
    const checkIn = buildCheckIn(dayIndex);
    const decision = decideTrainingMode(checkIn);

    const { error: checkinError } = await admin.from('daily_checkins').insert({
      user_id: userId,
      date: dateStr,
      energy: checkIn.energy,
      available_minutes: checkIn.availableMinutes,
      equipment_context: checkIn.equipmentContext,
      decision,
    });
    if (checkinError) throw new Error(`Could not seed check-in for ${dateStr}: ${checkinError.message}`);
    // CHOICE only arises on low-energy/low-time days: demo data always
    // takes the active-recovery branch rather than the "no plan" REST one.
    // decideTrainingMode itself never returns REST (only CHOICE resolution
    // does, ADR-0011) — the branch below is exhaustive in practice.
    const mode = decision.kind === 'CHOICE' || decision.kind === 'REST' ? 'ACTIVE_RECOVERY' : decision.kind;
    const effectiveLimitations = effectiveLimitationsForToday(profileLimitations, checkIn);

    const plan = generateDeterministicPlan({
      catalog: EXERCISE_CATALOG,
      mode,
      goal: DEMO_GOAL,
      availableMinutes: checkIn.availableMinutes,
      equipmentContext: checkIn.equipmentContext,
      effectiveLimitations,
      lastUsedByExerciseId: state.lastUsedByExerciseId,
      currentLoadKgByExerciseId: state.currentLoadKgByExerciseId,
    });

    const saved = await repository.savePlan(userId, dateStr, plan);
    if (!saved.ok) throw new Error(`Could not save plan for ${dateStr}: ${saved.error.message}`);

    await logSession(repository, userId, saved.value.id, plan, date, state);

    // /progress only counts finalized sessions (ended_at not null) — see
    // getFinalizedPlansInRange / getRecentSetLogs. Without this, seeded
    // sessions never show up on the progress page.
    const ended = await repository.endSession(userId, saved.value.id, null);
    if (!ended.ok) throw new Error(`Could not finalize session for ${dateStr}: ${ended.error.message}`);

    await admin.rpc('increment_generation_quota', { p_user_id: userId, p_date: dateStr });
    sessionsLogged++;
  }

  console.log(`Seeded ${sessionsLogged} sessions over the last ${HISTORY_DAYS} days for user ${userId}.`);
}

async function main(): Promise<void> {
  const { email, reset } = parseArgs(process.argv.slice(2));
  const admin: SupabaseClient = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userId = await resolveUserId(admin, email);
  if (reset) await resetDemoData(admin, userId);
  await seed(admin, userId);
}

main().catch((error) => {
  console.error(`[seed-demo-data] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
