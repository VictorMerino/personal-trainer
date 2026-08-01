# Feature: WorkoutPlanner port, history summarisation, and failure handling

Specifies the shared contract every planner (Groq, OpenRouter, deterministic)
implements, the shared history transformation both the LLM prompt and the
deterministic generator read from, and how failures at each tier are
handled. See `docs/adr/0005-workout-planner-port.md` for rationale.

## Background

```
Given a chain of WorkoutPlanner implementations exists, ending in the
  deterministic generator
And SetLog history exists for the user across some number of past sessions
```

## Scenario: A single planner failure is a Result value, not a thrown error

```
Given a planner's tryGenerate encounters a rate limit
When tryGenerate resolves
Then it resolves to { ok: false, error: ... }
And it does not throw
```

## Scenario: The chain moves to the next planner on a Result failure

```
Given FallbackChainPlanner has [groqPlanner, openRouterPlanner, deterministicPlanner]
And groqPlanner.tryGenerate resolves to { ok: false, ... }
And openRouterPlanner.tryGenerate resolves to { ok: true, plan }
When FallbackChainPlanner.generate is called
Then the caller receives openRouterPlanner's plan
And deterministicPlanner is never invoked
```

## Scenario: Every failure is recorded via telemetry, regardless of position in the chain

```
Given groqPlanner fails and openRouterPlanner succeeds
When FallbackChainPlanner.generate is called
Then telemetry.record is called once for groqPlanner's failure
And no telemetry.record call is made for openRouterPlanner (it succeeded)
```

## Scenario: Exhausting the entire chain throws, it does not return a degraded result

```
Given every planner in the chain, including deterministicPlanner, resolves
  to { ok: false, ... }
When FallbackChainPlanner.generate is called
Then it throws NoPlannerAvailableError
And it does not return any WorkoutPlan, degraded or otherwise
```

## Scenario: A build of HistorySummary is a pure function of stored SetLog history

```
Given a fixed set of SetLog records for a user
When buildHistorySummary is called with the same userId and since date twice
Then both calls return deep-equal results
And no network call or mock is required to compute it
```

## Scenario: perExercise reflects the most recent use, load and stall state

```
Given a user's last session for exercise "back-squat" used 42.5kg,
  logged 2026-07-30, and did not trigger a stall
When buildHistorySummary is called
Then perExercise["back-squat"] has lastUsedAt = 2026-07-30, currentLoadKg = 42.5
```

## Scenario: perPattern volume counts sets, not tonnage, and is comparable across exercise kinds

```
Given in the last 14 days the user did 3 sets of a barbell back squat
  (knee-dominant, load-based) and 4 sets of bodyweight split squats
  (knee-dominant, no load)
When buildHistorySummary is called
Then perPattern["knee-dominant"].volume = 7
And no load or bodyweight conversion is used in computing it
```

## Scenario: A pattern with no recent sessions has a clearly absent, not zero-defaulted, "days since trained"

```
Given the user has never trained the "vertical-pull" pattern
When buildHistorySummary is called
Then perPattern["vertical-pull"].daysSinceTrained is null, not 0
And consumers must handle the null case explicitly (e.g. treat as highest priority)
```

## Scenario: The LLM-facing prompt receives only the per-pattern aggregate, never raw SetLog rows

```
Given a HistorySummary has been computed for a user
When the prompt for the LLM planner is assembled
Then it includes only the perPattern projection
And it does not include perExercise, individual SetLog rows, or load history beyond the aggregate
```

## Scenario: The deterministic generator reads perExercise directly, bypassing any LLM-facing serialization

```
Given a HistorySummary has been computed for a user
When the deterministic generator selects an exercise for a pattern
Then it reads lastUsedAt, currentLoadKg and stallCounter from perExercise
  for the candidate exercises
And this does not go through prompt construction at all
```

## Non-goals (explicitly out of scope)

- Throwing on an individual planner's routine failure. See ADR 0005 decision 1.
- Returning a degraded or partial plan when the chain is fully exhausted —
  that case always throws.
- Tonnage-based volume. See ADR 0005 decision 5.
- Inline failure-rate checking within a single request's control flow —
  rate alerting is separate infrastructure over recorded telemetry.
