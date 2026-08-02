-- docs/adr/0007-data-model-rls.md decision 2: WorkoutPlan as JSONB
-- (validated against WorkoutPlanSchema on write and read, in application
-- code, not by a DB constraint); SetLog fully normalized.

create table workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  date date not null,
  mode text not null check (mode in ('NORMAL', 'DELOAD', 'ACTIVE_RECOVERY')),
  generated_by text not null check (generated_by in ('groq', 'openrouter', 'deterministic')),
  schema_version int not null,
  prompt_version int,
  plan jsonb not null,
  created_at timestamptz not null default now()
);

create table set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  workout_plan_id uuid not null references workout_plans(id),
  exercise_id text not null,
  movement_pattern text not null,
  set_index int not null,
  actual_reps int,
  actual_load_kg numeric,
  actual_seconds int,
  actual_rpe numeric not null,
  logged_at timestamptz not null default now()
);
