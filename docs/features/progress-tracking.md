# Feature: Progress tracking

Specifies the on-demand `ProgressSnapshot` computation: adherence and volume
per movement pattern over an 8-week trend window. See
`docs/adr/0010-progress-tracking.md` for rationale. Bodyweight is out of
scope — see Non-goals.

## Background

```
Given a user has some history of finalized and in-progress workout_plans,
  with associated set_logs
```

## Scenario: computeProgressSnapshot reads only existing stored data

```
Given a fixed set of workout_plans and set_logs for a user
When computeProgressSnapshot is called for a date range
Then it returns a result derived entirely from those existing rows
And no new row is written to the database as a side effect
```

## Scenario: computeProgressSnapshot is deterministic for a fixed range

```
Given the same user, workout_plans, set_logs and date range
When computeProgressSnapshot is called twice
Then both calls return deep-equal results
```

## Scenario: Adherence only counts finalized sessions

```
Given one workout plan in the range is finalized (ended_at set) with
  6 of 8 sets logged
And another workout plan in the range is still in progress (ended_at null)
  with 2 of 8 sets logged
When adherence is computed for the range
Then only the finalized plan's 6/8 contributes to the aggregate
And the in-progress plan is excluded entirely, not counted as 0/8
```

## Scenario: Volume per pattern uses an 8-week window, not the 14-day generation window

```
Given a user has knee-dominant sets logged 10, 30 and 50 days ago
When the progress view's volume-per-pattern is computed
Then sets from 10 and 30 days ago are included (within 8 weeks)
And the set from 50 days ago is excluded
And this window is independent of HistorySummary's 14-day window used for
  workout generation
```

## Scenario: A brand-new user with no history gets an empty, not broken, snapshot

```
Given a user has no workout_plans or set_logs at all
When computeProgressSnapshot is called
Then it returns a snapshot with zero adherence and zero volume per pattern
And it does not error
```

## Non-goals (explicitly out of scope)

- Bodyweight tracking. Deferred to the roadmap, bundled with nutrition —
  see ADR 0010 decision 2. No `bodyweight_logs` table exists yet.
- A precomputed/stored `ProgressSnapshot` table. See ADR 0010 decision 1.
