# ADR 0007 — Data model, RLS, and quota concurrency

## Status

Accepted

## Context

Supabase (Postgres + Auth + RLS) is the chosen backend
(`docs/PROJECT-BRIEF.md` §3). This ADR fixes the table shapes for the
domain entities designed so far (§5, and ADRs 0001–0006), the row-level
security pattern, and how the daily generation quota is enforced against
concurrent requests. The exercise catalog itself is explicitly **not** a DB
table (`docs/PROJECT-BRIEF.md` §6) — out of scope here.

## Decisions

### 1. Check-in pain supports multiple zones per day, not one

A single check-in can report pain in any number of zones simultaneously
(e.g. both knee and lower back on a bad day) — a real body doesn't confine
itself to one problem area, and ADR 0001's merge-by-zone logic already
assumes this shape. This is a one-to-many relationship, not two columns on
the check-in row:

```sql
create table daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  date date not null,
  energy text not null check (energy in ('low', 'medium', 'high')),
  available_minutes int not null,
  equipment_context text not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table checkin_pain_reports (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references daily_checkins(id) on delete cascade,
  zone text not null,
  level text not null check (level in ('none', 'mild', 'moderate', 'severe')),
  unique (checkin_id, zone)
);
```

### 2. `WorkoutPlan` is stored as one JSONB column, validated against `WorkoutPlanSchema` on write and read; `SetLog` is fully normalized

```sql
create table workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  date date not null,
  mode text not null check (mode in ('NORMAL', 'DELOAD', 'ACTIVE_RECOVERY')),
  generated_by text not null check (generated_by in ('groq', 'openrouter', 'deterministic')),
  schema_version int not null,
  prompt_version int,   -- null for deterministic-generated plans, no prompt involved
  plan jsonb not null,  -- validated against WorkoutPlanSchema on write and read
  created_at timestamptz not null default now()
);

create table set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  workout_plan_id uuid not null references workout_plans(id),
  exercise_id text not null,
  movement_pattern text not null,   -- denormalized from the catalog at log time, for query efficiency
  set_index int not null,
  actual_reps int,
  actual_load_kg numeric,
  actual_seconds int,
  actual_rpe numeric not null,
  logged_at timestamptz not null default now()
);
```

**Why JSONB for `WorkoutPlan`:** the plan is always read and written as one
whole unit — generated once, displayed once as a complete session, never
queried at the sub-plan level ("find all plans that prescribed exercise
X" has not come up anywhere in the design). Normalizing it into
`blocks`/`prescribed_exercises`/`set_targets` tables would add join
complexity and migration surface for a query pattern that doesn't exist.
`SetLog` is the opposite case: `HistorySummary` (ADR 0005) genuinely
aggregates across many `SetLog` rows per user (`perExercise.lastUsedAt`,
`perPattern.volume`, stall detection) — that's exactly the shape relational
tables and SQL aggregation are for.

**This is a reversible choice, not a one-way door.** Postgres's JSON
aggregation functions (`jsonb_agg`, `json_build_object`) make a future
normalized → JSONB migration for `SetLog` straightforward if that ever
becomes necessary; the reverse (unpacking `WorkoutPlan`'s JSONB into
strict relational tables) is more delicate since it requires validating
every historical blob against current constraints as it's unpacked. Neither
direction is "nearly impossible" — this decision doesn't need to be
treated as higher-stakes than it is.

### 3. Every user-owned table enforces RLS with the same pattern: `user_id = auth.uid()`

```sql
alter table daily_checkins enable row level security;
create policy "own checkins" on daily_checkins
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- same pattern repeated for workout_plans, set_logs, user_profiles,
-- limitations, generation_quota
```

`checkin_pain_reports` inherits protection via its `checkin_id` foreign key
join to `daily_checkins`, using a policy that checks the parent row's
`user_id` rather than duplicating a `user_id` column on the child table.

### 4. Daily generation quota uses an atomic increment, not check-then-write

```sql
create table generation_quota (
  user_id uuid not null references auth.users(id),
  date date not null,
  count int not null default 0,
  primary key (user_id, date)
);

create or replace function increment_generation_quota(p_user_id uuid, p_date date)
returns int
language sql
as $$
  insert into generation_quota (user_id, date, count)
  values (p_user_id, p_date, 1)
  on conflict (user_id, date)
  do update set count = generation_quota.count + 1
  returning count;
$$;
```

The application checks the returned count against `DAILY_GENERATION_LIMIT`
*after* the atomic increment, denying the request (without calling any
provider) if the limit was exceeded. A plain "read count, compare, then
write" sequence has a real race window: two near-simultaneous requests
(a double-tap, two open tabs) can both read the same "under limit" count
before either writes back, both proceed, and the quota — whose entire
purpose is a hard spend cap — silently gets exceeded. Since the quota
mechanism's only job is guaranteeing that cap, and an atomic increment costs
no more code than the racy version, there's no reason to accept the race.

**Note (forward reference, not part of this ADR):** client-side UX — disabling
the generate button after one tap, detecting a session already open in
another tab and offering to transfer or continue there — is a good idea for
smoothing the common case and belongs in the UI flows design (item 9). It is
explicitly *not* a substitute for this atomic increment: client-side
controls can be bypassed or raced around (retries, multiple devices, bugs),
so the DB-level atomic increment remains the actual guarantee.

## Consequences

- `checkin_pain_reports`, `set_logs` and `generation_quota` all reference
  their parent by ID with `on delete cascade` or FK constraints as
  appropriate — deleting a check-in or a workout plan cleans up its
  children.
- `WorkoutPlanSchema` validation on read (not just write) is a deliberate
  defense-in-depth choice: a plan that was valid when written under an
  older `schema_version` should be caught, not silently misinterpreted, if
  the schema has since changed incompatibly.
- The quota check happens *before* any provider call, consistent with the
  degradation-chain design (`docs/adr/0005-workout-planner-port.md`) — a
  denied request never reaches `FallbackChainPlanner` at all; it falls
  through to the deterministic generator by the existing "no provider
  available" path already designed.
- RLS is the same repeated pattern across every user-owned table — no
  per-table bespoke policy logic to review.

## Alternatives considered

- **One pain zone/level per check-in** — rejected, see decision 1.
- **Fully normalized `WorkoutPlan` storage** — rejected, see decision 2.
- **Check-then-write quota enforcement** — rejected, see decision 4.
