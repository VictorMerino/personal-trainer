-- docs/adr/0007-data-model-rls.md decision 3: every user-owned table gets
-- the same "user_id = auth.uid()" policy. checkin_pain_reports has no
-- user_id column of its own; it inherits protection via a join to its
-- parent daily_checkins row, per the ADR.

alter table user_profiles enable row level security;
create policy "own profile" on user_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table limitations enable row level security;
create policy "own limitations" on limitations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table daily_checkins enable row level security;
create policy "own checkins" on daily_checkins
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table checkin_pain_reports enable row level security;
create policy "own checkin pain reports" on checkin_pain_reports
  for all using (
    exists (
      select 1 from daily_checkins
      where daily_checkins.id = checkin_pain_reports.checkin_id
        and daily_checkins.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from daily_checkins
      where daily_checkins.id = checkin_pain_reports.checkin_id
        and daily_checkins.user_id = auth.uid()
    )
  );

alter table workout_plans enable row level security;
create policy "own workout plans" on workout_plans
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table set_logs enable row level security;
create policy "own set logs" on set_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table generation_quota enable row level security;
create policy "own generation quota" on generation_quota
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
