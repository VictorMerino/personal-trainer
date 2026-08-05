-- ADR-0009: explicit skip-exercise/end-session actions, distinct from "not
-- reached yet" (an absent set_logs row with the session still in progress).

alter table workout_plans
  add column ended_at timestamptz,       -- null = still in progress
  add column ended_reason text check (ended_reason in ('pain', 'time', 'other'));

-- Per-exercise skip marker (ADR-0009 consequences: "a per-exercise skip
-- marker" alongside ended_at) — normalized like set_logs, rather than an
-- array column, so it can carry its own optional reason (decision 2) and
-- extend cleanly if a future feature wants per-exercise adherence, without
-- a schema rewrite.
create table skipped_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_plan_id uuid not null references workout_plans(id) on delete cascade,
  exercise_id text not null,
  reason text check (reason in ('pain', 'time', 'other')),
  skipped_at timestamptz not null default now(),
  unique (workout_plan_id, exercise_id)
);

alter table skipped_exercises enable row level security;
create policy "own skipped exercises" on skipped_exercises
  for all using (
    exists (
      select 1 from workout_plans
      where workout_plans.id = skipped_exercises.workout_plan_id
        and workout_plans.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workout_plans
      where workout_plans.id = skipped_exercises.workout_plan_id
        and workout_plans.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on skipped_exercises to authenticated, service_role;

-- Autosave-per-set (ADR-0008 decision 4) means the same set can be logged
-- more than once (a correction) — upsert on this key rather than allowing
-- duplicate rows for the same prescribed set.
alter table set_logs add constraint set_logs_plan_exercise_set_unique unique (workout_plan_id, exercise_id, set_index);
