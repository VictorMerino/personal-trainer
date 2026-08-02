# Feature: Test strategy per layer

Specifies how each architectural layer (domain, application, infrastructure,
UI/E2E) is tested, and why. See `docs/adr/0012-test-strategy.md` for
rationale.

## Background

```
Given the layered architecture from docs/PROJECT-BRIEF.md §4
And the coverage thresholds from docs/PROJECT-BRIEF.md §8
```

## Scenario: A readiness-policy decision table row has a corresponding example test

```
Given docs/adr/0001-readiness-policy.md's energy/pain/time decision table
When the domain test suite is inspected
Then each row of the table has at least one explicit example-based test
And no mocks are used anywhere in the domain test suite
```

## Scenario: A progression property test catches an invariant violation

```
Given a property test asserting "DELOAD never increases prescribed sets
  relative to the same inputs under NORMAL"
When fast-check generates a counterexample input
Then the test fails
And the failure is traceable to a specific generated input, not a fixed example
```

## Scenario: An LLM adapter test replays a recorded fixture, no live call

```
Given fixtures/groq-malformed-json.json, captured from a real Groq response
When the GroqPlannerAdapter unit test runs
Then it parses the recorded fixture, not a live API response
And the test suite makes zero network calls
```

## Scenario: A live smoke test is not part of the per-push CI run

```
Given the GitHub Actions pipeline described in docs/PROJECT-BRIEF.md §8
When a normal push triggers CI
Then no live call to Groq or OpenRouter occurs
And the live smoke test only runs on a separate scheduled job
```

## Scenario: RLS blocks a cross-user read via the real Supabase client

```
Given user A and user B are both authenticated supabase-js clients
  against a local Supabase instance
And a workout_plans row exists that belongs to user A
When user B's client attempts to read that row
Then the response is empty, not an error that reveals the row exists
```

## Scenario: The application layer tests a use case with a mocked planner, real domain

```
Given GenerateTodayWorkout is under test
And a fake WorkoutPlanner whose tryGenerate resolves to { ok: false, ... }
When the use case runs
Then the real readiness/progression domain logic executes unmocked
And the fake planner's failure is handled via the fallback chain,
  not a thrown exception
```

## Scenario: The golden-path E2E spec covers check-in through finalize, including a skip

```
Given a Playwright test starting from a fresh check-in
When the user completes NORMAL check-in, generation, logs sets,
  skips one exercise (docs/adr/0009-incomplete-sessions.md), and finalizes
Then the session is recorded as finalized
And the skipped exercise is reflected in the finalized session state
```

## Scenario: The CHOICE-branch E2E spec covers check-in through resolution

```
Given a Playwright test starting from a check-in that resolves to CHOICE
When the user selects REST
Then a zero-exercise workout_plans row is created
And no call to POST /api/workouts/generate occurs
```

## Non-goals (explicitly out of scope)

- pgTAP-based RLS testing — deferred, see ADR 0012 decision 3's revisit
  trigger.
- E2E coverage of settings, profile editing, or progress-chart browsing —
  these stay at component-test level per §8's "critical flows only."
- Automating LLM fixture recapture — recapture is a manual step for now, see
  ADR 0012 decision 2.
