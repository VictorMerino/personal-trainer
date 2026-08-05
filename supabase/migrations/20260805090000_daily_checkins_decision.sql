-- ADR-0011: check-in submission computes and persists a TrainingDecision;
-- a CHOICE decision is later overwritten in place once /choice resolves it,
-- so the same row always reflects "today's final decision."
alter table daily_checkins add column decision jsonb not null default '{"kind": "NORMAL"}';
alter table daily_checkins alter column decision drop default;
