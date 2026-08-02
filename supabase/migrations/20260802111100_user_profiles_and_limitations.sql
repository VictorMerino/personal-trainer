-- UserProfile and Limitation (docs/PROJECT-BRIEF.md §5).
-- Column shapes inferred from the domain model and the enums fixed in
-- docs/adr/0003-deterministic-generator.md (goal) and
-- docs/PROJECT-BRIEF.md §6 (BodyZone) — docs/adr/0007-data-model-rls.md
-- names these tables in its RLS pattern list but does not spell out their
-- DDL, since its focus is check-ins/plans/quota.

create table user_profiles (
  user_id uuid primary key references auth.users(id),
  goal text not null check (goal in ('strength', 'hypertrophy', 'general_fitness')),
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  default_equipment_context text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table limitations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  zone text not null check (zone in (
    'knee', 'hip', 'lower-back', 'shoulder', 'elbow', 'wrist', 'ankle', 'neck'
  )),
  severity text not null check (severity in ('none', 'mild', 'moderate', 'severe')),
  status text not null check (status in ('active', 'resolved')) default 'active',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
