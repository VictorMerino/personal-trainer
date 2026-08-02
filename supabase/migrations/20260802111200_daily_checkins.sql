-- docs/adr/0007-data-model-rls.md decision 1: multiple pain zones per check-in.

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
