# Feature: Progression and autoregulation

Specifies how logged RPE adjusts future load, how a stalled exercise gets a
deliberate backoff, and how a reintroduced exercise restarts conservatively.
See `docs/adr/0004-progression-autoregulation.md` for rationale. These rules
apply per exercise, layered into the deterministic generator's per-exercise
sizing step (`docs/features/deterministic-generator.md`).

## Background

```
Given an exercise has prior SetLog history for this user
And that history includes, per set, the prescribed rpeTarget and the actual
  logged rpe
```

## Scenario: A set that felt easier than intended increases next session's load

```
Given the average actual RPE across an exercise's working sets was at least
  RPE_UNDERSHOOT_THRESHOLD below the prescribed rpeTarget
When next session's load for that exercise is computed
Then the load increases by LOAD_INCREMENT_PCT over the current working load
```

## Scenario: A set that felt harder than intended holds the load, it does not decrease it

```
Given the average actual RPE across an exercise's working sets was at least
  RPE_OVERSHOOT_THRESHOLD above the prescribed rpeTarget
When next session's load for that exercise is computed
Then the load is held at the current working load
And it is not automatically reduced
```

## Scenario: An on-target session holds the load

```
Given the average actual RPE was within RPE_UNDERSHOOT_THRESHOLD and
  RPE_OVERSHOOT_THRESHOLD of the prescribed rpeTarget
When next session's load for that exercise is computed
Then the load is held at the current working load
```

## Scenario: A stalled exercise gets one deliberate backoff session

```
Given an exercise's load has not increased for STALL_SESSIONS_THRESHOLD
  consecutive sessions
When the next session for that exercise is generated
Then rpeTarget is capped below its normal value for that one session
And the load is held or reduced, not increased
And this is independent of today's TrainingDecision (readiness) kind
```

## Scenario: The stall counter resets after a backoff session

```
Given an exercise just received a stall-triggered backoff session
When the session after that is generated
Then normal autoregulation (undershoot/overshoot comparison) resumes
And the stall counter starts counting from zero again
```

## Scenario: Readiness-DELOAD and stall-backoff can occur independently within the same session

```
Given today's TrainingDecision is NORMAL
And exercise A has stalled (STALL_SESSIONS_THRESHOLD reached)
And exercise B has not stalled
When today's session is generated
Then exercise A receives a stall-triggered backoff
And exercise B is prescribed normally, following ordinary autoregulation
```

```
Given today's TrainingDecision is DELOAD (readiness-triggered)
And exercise A has also independently stalled
When today's session is generated
Then exercise A's prescription reflects both the session-level DELOAD cap
  and the fact that it does not count as a fresh, separate stall event
```

## Scenario: A resolved limitation makes its excluded exercise eligible again

```
Given a Limitation for zone "knee" is marked resolved
And an exercise was previously excluded from selection for that zone
When the exercise catalog is filtered for today's session
Then that exercise is now a valid candidate
```

## Scenario: A reintroduced exercise restarts at a reduced load and capped RPE

```
Given an exercise's last known working load before its limitation-driven
  exclusion was 40kg
And its limitation has just been marked resolved
When it is selected for the first session after reintroduction
Then its prescribed load is 40kg * REINTRODUCTION_LOAD_FACTOR
And its rpeTarget is capped at REINTRODUCTION_RPE_CAP
```

## Scenario: Autoregulation resumes normally after the reintroduction session

```
Given an exercise was reintroduced last session at a reduced load
When the following session is generated
Then load/RPE comparison follows the normal undershoot/overshoot rule
  (no further automatic reduction)
```

## Scenario: Rotation naturally favors a just-reintroduced exercise

```
Given a reintroduced exercise has an older (or absent) "last used" timestamp
  than other valid candidates for its pattern
When the generator selects an exercise for that pattern
Then the reintroduced exercise is selected ahead of more recently used ones,
  with no special-case logic beyond the existing least-recently-used rule
```

## Non-goals (explicitly out of scope)

- Any load reduction from a single hard (overshoot) session — only sustained
  stall triggers a backoff.
- Merging stall-backoff into the session-level `TrainingDecision`. See ADR
  0004 decision 1.
- Clinically validated thresholds. The numeric constants are MVP defaults,
  not verified by a sports-science professional — flagged for revisit in
  ADR 0004.
