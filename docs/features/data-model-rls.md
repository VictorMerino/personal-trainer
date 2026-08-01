# Feature: Data model, RLS and quota concurrency

Specifies table shapes, row-level security, and race-safe quota enforcement.
See `docs/adr/0007-data-model-rls.md` for rationale.

## Background

```
Given Supabase Auth is configured with public signup disabled
And every user-owned table has RLS enabled
```

## Scenario: A check-in can report pain in multiple zones at once

```
Given a user submits a check-in reporting pain in both "knee" (moderate)
  and "lower-back" (mild)
When the check-in is persisted
Then two rows exist in checkin_pain_reports for that check-in
And each has its own zone and level
```

## Scenario: A check-in with no pain reported has zero pain report rows

```
Given a user submits a check-in with no pain in any zone
When the check-in is persisted
Then no rows exist in checkin_pain_reports for that check-in
```

## Scenario: A stored WorkoutPlan is validated against the schema on both write and read

```
Given a plan is generated and persisted
When it is later read back for display
Then it is re-validated against WorkoutPlanSchema
And a plan that fails re-validation is surfaced as an error, not silently
  displayed in a broken state
```

## Scenario: A user cannot read another user's check-ins, plans, or set logs

```
Given user A and user B both have data in daily_checkins, workout_plans,
  and set_logs
When user A queries their own data via the Supabase client
Then only rows where user_id = user A's auth id are returned
And no row belonging to user B is visible, even if user A crafts a query
  requesting it directly
```

## Scenario: Two concurrent generation requests never both bypass the quota

```
Given a user is at DAILY_GENERATION_LIMIT - 1 generations used today
And two generation requests arrive at nearly the same instant
When both call increment_generation_quota
Then exactly one of them receives a count that exceeds DAILY_GENERATION_LIMIT
And that one is denied before any provider is called
And the other proceeds normally
```

## Scenario: A denied quota request falls through to the deterministic generator, not an error page

```
Given a user has exceeded DAILY_GENERATION_LIMIT for today
When they request a new workout
Then no Groq or OpenRouter call is made
And the deterministic generator serves the request instead
```

## Scenario: Deleting a workout plan cleans up its set logs

```
Given a workout plan has associated set_logs rows
When the workout plan is deleted
Then its associated set_logs rows are also removed
```

## Non-goals (explicitly out of scope)

- Client-side prevention of double-submission or concurrent-session
  detection. Real UX improvements, but not this feature's guarantee — see
  ADR 0007's forward reference to the UI flows design (item 9). The atomic
  increment is the actual guarantee tested here.
- Normalizing WorkoutPlan into relational tables. See ADR 0007 decision 2.
