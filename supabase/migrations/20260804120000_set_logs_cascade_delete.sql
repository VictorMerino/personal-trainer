-- docs/features/data-model-rls.md scenario "Deleting a workout plan cleans
-- up its set logs": the original FK (20260802111300) had no ON DELETE
-- behavior, so deleting a workout_plans row would just fail on the
-- constraint instead of cascading, per ADR-0007's consequences.

alter table set_logs
  drop constraint set_logs_workout_plan_id_fkey,
  add constraint set_logs_workout_plan_id_fkey
    foreign key (workout_plan_id) references workout_plans(id)
    on delete cascade;
