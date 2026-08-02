-- docs/adr/0007-data-model-rls.md decision 4: atomic increment, not
-- check-then-write, to close the double-tap/two-tabs race on the daily cap.

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
