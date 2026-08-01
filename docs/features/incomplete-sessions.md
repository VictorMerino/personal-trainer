# Feature: Incomplete sets, skipped exercises, and session finalization

Specifies how a short-of-prescription set, a skipped exercise, and an early
session end are represented and how they feed adherence and history. See
`docs/adr/0009-incomplete-sessions.md` for rationale.

## Background

```
Given a WorkoutPlan has been generated and the gym logger is in use
And workout_plans has an ended_at column, null while in progress
```

## Scenario: A set completed with fewer reps than prescribed needs no special handling

```
Given a set prescribes 8 reps
When the user logs 6 reps at RPE 10
Then the SetLog row is saved exactly as logged
And no "skipped" or "incomplete" flag is set anywhere
```

## Scenario: An unlogged set before end-session is "not reached yet," not skipped

```
Given a workout plan has 4 prescribed sets for an exercise
And the user has logged 2 of them
And the session has not been ended (ended_at is null)
When the plan's completion state is queried
Then the remaining 2 sets are not counted as skipped
And the session is treated as still in progress
```

## Scenario: Skipping an exercise marks only that exercise's remaining sets as skipped

```
Given an exercise has 4 prescribed sets and 1 is logged
When the user taps "skip this exercise"
Then the remaining 3 sets for that exercise are recorded as skipped
And other exercises in the plan are unaffected
And the session itself remains in progress (ended_at still null)
```

## Scenario: Ending the session finalizes all remaining unlogged sets as skipped

```
Given a workout plan has sets remaining unlogged across multiple exercises
When the user taps "end session"
Then ended_at is set
And every remaining unlogged prescribed set across the whole plan is
  recorded as skipped
```

## Scenario: An end-session or skip-exercise action can carry an optional reason

```
Given the user taps "end session"
When they select the reason "pain"
Then ended_reason is recorded as "pain"
And selecting no reason leaves ended_reason null
```

## Scenario: A stop reason never changes today's already-made TrainingDecision

```
Given today's TrainingDecision was already NORMAL
And the user ends the session early with reason "pain"
When the stop reason is recorded
Then today's TrainingDecision remains NORMAL, unmodified
```

## Scenario: A stop reason never auto-creates or modifies a Limitation

```
Given the user has tagged "pain" as the stop reason on 3 separate sessions
  this month, all for the same zone
When the third one is recorded
Then no Limitation is automatically created or escalated
And the pattern is only visible as a note in the user's own progress view
```

## Scenario: Adherence is only computed for finalized sessions

```
Given one workout plan is finalized (ended_at set) with 6 of 8 sets logged
And another workout plan is still in progress (ended_at null)
When adherence is calculated
Then the finalized plan contributes 6/8 to the adherence calculation
And the in-progress plan is excluded entirely, not counted as 0%
```

## Scenario: HistorySummary only reads from finalized sessions

```
Given a session is still in progress (ended_at null) and includes a logged
  set for exercise "back-squat"
When buildHistorySummary computes perExercise["back-squat"].lastUsedAt
Then it does not count that in-progress session's set
  until the session has been finalized
```

## Non-goals (explicitly out of scope)

- A `status` field on individual SetLog rows. See ADR 0009 alternatives
  considered.
- Automatic Limitation creation or escalation from repeated pain-tagged
  stops. See ADR 0009 decision 3.
- Inferring session completion from elapsed time. Rejected outright, not a
  deferred option.
