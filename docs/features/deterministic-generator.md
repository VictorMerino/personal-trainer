# Feature: Deterministic workout generator

Specifies the network-free fallback generator: split selection, exercise
rotation, and set/rep sizing by goal and readiness. See
`docs/adr/0003-deterministic-generator.md` for rationale.

## Background

```
Given the exercise catalog and contraindication-policy already exist
And a TrainingDecision of kind NORMAL, DELOAD or ACTIVE_RECOVERY has already
  been made (readiness-policy, ADR 0001) — CHOICE is resolved before this point
```

## Scenario: A NORMAL session targets a spread of movement patterns

```
Given available time is enough for at least the core pattern list
When the deterministic generator builds a session
Then it includes one exercise for each of: knee-dominant, hip-dominant,
  horizontal-push, horizontal-pull, core
And accessories are added only if time remains after the core list
```

## Scenario: Limited time trims the pattern list, not the guardrails

```
Given available time is only enough for 2 of the core patterns
When the deterministic generator builds a session
Then it selects the 2 highest-priority patterns from the fixed order
And every selected exercise still passes equipment and contraindication filtering
```

## Scenario: Exercise selection picks the least-recently-used valid candidate

```
Given the "knee-dominant" pattern has 3 valid candidates after filtering
And exercise A was last used 10 days ago, B was last used 2 days ago,
  and C has never been used
When the generator selects a knee-dominant exercise
Then it selects C (never used)
```

## Scenario: A tie between never-used candidates is resolved deterministically

```
Given two valid candidates for a pattern have both never been used
When the generator selects between them
Then the same input always produces the same output
  (e.g. stable tie-break by exercise ID, not random)
```

## Scenario: Rotation never falls back to random selection

```
Given a valid candidate set for a pattern
When the generator is run twice with identical profile, check-in and history
Then it produces the exact same exercise selection both times
```

## Scenario: Rep range is set by training goal

```
Given the user's goal is "strength"
When a load-based or reps-based exercise is prescribed
Then its rep range is { min: 4, max: 6 }
```

```
Given the user's goal is "hypertrophy"
Then the rep range is { min: 8, max: 12 }
```

```
Given the user's goal is "general_fitness"
Then the rep range is { min: 10, max: 15 }
```

## Scenario: DELOAD reduces effort and set count, not exercise selection

```
Given a NORMAL session for this user would select exercise X for a given pattern
  with 4 sets at rpeTarget 8
And today's TrainingDecision is DELOAD
When the deterministic generator builds today's session
Then it selects the same exercise X for that pattern
And rpeTarget is capped below the NORMAL value (e.g. 6-7)
And the set count is reduced by 1 relative to the NORMAL prescription
```

## Scenario: DELOAD never reduces sets below the floor

```
Given a NORMAL prescription for an exercise has 2 sets
And today's TrainingDecision is DELOAD
When the deterministic generator builds today's session
Then the set count remains 2, not reduced further
```

## Scenario: ACTIVE_RECOVERY produces a single duration+RPE block, not a full split

```
Given today's TrainingDecision is ACTIVE_RECOVERY
When the deterministic generator builds today's session
Then it produces one block with role "main"
And that block has one cardio or mobility exercise
And its only set is { kind: 'time', seconds, rpeTarget }
And no other pattern slots are filled
```

## Scenario: The generator always succeeds with no network access

```
Given no LLM provider is available or configured
When the deterministic generator is invoked directly (last link in the chain)
Then it returns a valid WorkoutPlan
And it required no network call at any point
```

## Non-goals (explicitly out of scope)

- Multi-day rotating splits (upper/lower, push/pull/legs). Flagged as a
  future extension point in ADR 0003, not built for MVP.
- Random exercise selection under any circumstance.
- Deload-driven exercise substitution (swapping to an "easier" variant
  instead of adjusting RPE/sets).
