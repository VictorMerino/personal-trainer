-- Table-level GRANTs, without which `authenticated`/`service_role` get
-- "permission denied" regardless of RLS: creating a table only grants CRUD
-- privileges to its owner (postgres). RLS restricts *which rows* a role
-- can touch; it does nothing until the role is also allowed to attempt the
-- operation at all. `anon` intentionally gets nothing — every endpoint
-- requires an authenticated session (docs/adr/0011-endpoint-contracts.md).

grant select, insert, update, delete on
  user_profiles,
  limitations,
  daily_checkins,
  checkin_pain_reports,
  workout_plans,
  set_logs,
  generation_quota
to authenticated, service_role;
