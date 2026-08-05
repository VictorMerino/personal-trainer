-- ADR-0011 endpoint contracts (profile routes): POST /api/profile/limitations
-- upserts rather than inserting a duplicate row for a zone that already has
-- an active limitation — the table means "current standing limitations,"
-- not an event log. A partial unique index (only over active rows) still
-- allows a zone to be resolved and later reopened as a new active row.
create unique index limitations_one_active_per_zone on limitations (user_id, zone) where status = 'active';

-- supabase-js's .upsert() only emits a plain column-list ON CONFLICT, which
-- cannot target a partial unique index (Postgres needs the matching WHERE
-- predicate as part of the conflict target) — a small function, same
-- pattern as increment_generation_quota (migration 20260802111400).
create or replace function upsert_active_limitation(p_user_id uuid, p_zone text, p_severity text)
returns limitations
language sql
as $$
  insert into limitations (user_id, zone, severity, status)
  values (p_user_id, p_zone, p_severity, 'active')
  on conflict (user_id, zone) where status = 'active'
  do update set severity = excluded.severity
  returning *;
$$;

