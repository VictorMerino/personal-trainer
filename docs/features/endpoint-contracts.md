# Feature: Endpoint contracts

Specifies the HTTP surface: check-in, choice resolution, generation, set
logging, session finalization, and progress reads. See
`docs/adr/0011-endpoint-contracts.md` for rationale.

## Background

```
Given every endpoint requires a valid Supabase session
And request/response bodies are Zod-validated
```

## Scenario: A NORMAL/DELOAD check-in requires a separate generate call

```
Given POST /api/checkin returns { decision: { kind: 'NORMAL' } }
When the client wants an actual workout
Then it must separately call POST /api/workouts/generate
And the check-in response alone contains no WorkoutPlan
```

## Scenario: An ACTIVE_RECOVERY check-in already includes a plan, with no generate call needed

```
Given POST /api/checkin returns { decision: { kind: 'ACTIVE_RECOVERY' } }
  (e.g. from severe pain)
When the response is inspected
Then a minimal WorkoutPlan already exists for that day
  (one block, one exercise, one time-based set)
And no call to POST /api/workouts/generate occurs
And no LLM planner or quota increment was involved
```

## Scenario: A CHOICE requires resolution before anything else happens

```
Given POST /api/checkin returns { decision: { kind: 'CHOICE', options: [...] } }
When the client calls POST /api/workouts/generate directly, without resolving first
Then the request is rejected
  (no TrainingDecision has been finalized yet for that check-in)
```

## Scenario: Resolving CHOICE to ACTIVE_RECOVERY_WALK produces a real plan, no generate call needed

```
Given a CHOICE was returned
When the client calls POST /api/checkin/:id/choice with selection ACTIVE_RECOVERY_WALK
Then the response includes a minimal WorkoutPlan (same shape as any ACTIVE_RECOVERY plan)
And no separate generate call is needed
```

## Scenario: Resolving CHOICE to REST creates a zero-exercise plan, excluded from adherence

```
Given a CHOICE was returned
When the client calls POST /api/checkin/:id/choice with selection REST
Then a workout_plans row is created with zero prescribed exercises
And this row is excluded from the adherence denominator entirely
And it is not counted as 0/0
```

## Scenario: Generation silently falls through the chain on exceeded quota, with no distinct error

```
Given the user has exceeded DAILY_GENERATION_LIMIT for today
When POST /api/workouts/generate is called
Then the response is 200 with a valid WorkoutPlan
And the plan's generatedBy is "deterministic"
And no quota-related error code or message appears anywhere in the response
```

## Scenario: An unauthenticated request is rejected uniformly

```
Given a request to any endpoint has no valid session
When it is received
Then it is rejected with 401
And the error body matches { error: { code, message } }
```

## Scenario: A malformed request body is rejected before touching any domain logic

```
Given a request to POST /api/checkin has an invalid energy value
When it is received
Then it is rejected with 400
And no TrainingDecision is computed
```

## Scenario: Referencing another user's resource returns 404, not 403

```
Given user A requests a workout_plans row belonging to user B
When the request is processed
Then it returns 404
And the response is identical in shape to a request for a genuinely
  nonexistent ID, so existence cannot be probed
```

## Scenario: Chain exhaustion surfaces as 500, not a degraded 200 response

```
Given every planner in the fallback chain fails, including the deterministic one
When POST /api/workouts/generate is called
Then the response is 500
And this is treated as worth alerting on, not a normal client-handled case
```

## Non-goals (explicitly out of scope)

- A distinct client-facing "quota exceeded" status or message. See ADR
  0011 decision 3.
- Combining check-in submission and generation into one endpoint. See ADR
  0011 decision 1.
