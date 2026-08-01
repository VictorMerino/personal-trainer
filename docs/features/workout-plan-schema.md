# Feature: WorkoutPlan schema and validation

Specifies parsing and business-validation behavior for `WorkoutPlan`, the
shared output contract for every link in the planner fallback chain (LLM or
deterministic). See `docs/adr/0002-workout-plan-schema.md` for rationale.

## Background

```
Given a permitted, already-filtered subset of the exercise catalog exists
  for the current user and check-in (see readiness-policy and
  contraindication-policy)
And WorkoutPlanSchema is the Zod schema for WorkoutPlan
```

## Scenario: A load-based set requires reps, loadKg and rpeTarget

```
Given a set with kind "load"
When it omits loadKg
Then WorkoutPlanSchema validation fails
```

## Scenario: A time-based set has no reps or loadKg field at all

```
Given a set with kind "time"
When it is validated
Then only seconds and rpeTarget are read or required
And a value present under reps or loadKg is a schema error, not silently ignored
```

## Scenario: Sets within one exercise may differ from each other

```
Given an exercise prescribed with 3 sets
And the first set targets loadKg 40, the second 45, the third 50
When the plan is validated
Then it is accepted — sets are not required to be identical
```

## Scenario: A plan referencing an exercise outside the permitted set is rejected outright

```
Given a plan that is otherwise schema-valid
And one exercise ID in it is not present in the permitted, filtered catalog subset
When the plan is validated end-to-end (schema + business rules)
Then the whole plan is rejected
And no attempt is made to drop only that exercise and keep the rest
```

## Scenario: A business-invalid plan is treated as a failed link in the fallback chain

```
Given FallbackChainPlanner is given [groqPlanner, deterministicPlanner]
And groqPlanner returns a schema-valid plan referencing a non-permitted exercise ID
When FallbackChainPlanner.generate is called
Then groqPlanner's result is treated as a failure
And deterministicPlanner is invoked next
And the plan the caller receives is deterministicPlanner's output, not a patched version of groq's
```

## Scenario: An active-recovery plan uses the same schema as any other plan

```
Given a TrainingDecision of kind ACTIVE_RECOVERY
When a plan is built for it
Then it validates against WorkoutPlanSchema with no special-cased schema
And it has exactly one block with role "main"
And that block's single exercise has sets of kind "time"
```

## Scenario: A stored plan records which link generated it

```
Given a plan was served by the deterministic generator after both Groq and
  OpenRouter failed
When the plan is persisted
Then generatedBy is "deterministic"
And this is queryable later, not only visible in logs
```

## Non-goals (explicitly out of scope)

- Partial acceptance / pruning of an otherwise invalid plan. See ADR 0002
  decision 5.
- A distinct schema or type for active-recovery plans.
