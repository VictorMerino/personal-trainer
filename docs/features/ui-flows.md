# Feature: Check-in and gym logger UI flows

Specifies the daily check-in flow, the CHOICE screen, and the gym logger's
autosave/rest-timer behavior. See `docs/adr/0008-ui-flows.md` for rationale.

## Background

```
Given a signed-in user with a completed profile
And decideTrainingMode and WorkoutPlan generation are already specified
  (readiness-policy, workout-plan-schema features)
```

## Scenario: A pain-free check-in completes in exactly four taps

```
Given the user has no pain today
When they complete the check-in
Then they tap through energy, "no pain", available minutes and equipment
  — four taps total, no typing at any step
```

## Scenario: A multi-zone pain day takes more than four taps, and that's expected

```
Given the user has pain in two zones today
When they complete the check-in
Then the pain step expands to a zone picker and a level picker per zone
And the total tap count exceeds four
And no text input is required at any point
```

## Scenario: A CHOICE outcome presents two equally-weighted options, no default

```
Given decideTrainingMode returns { kind: 'CHOICE', options: ['ACTIVE_RECOVERY_WALK', 'REST'] }
When the check-in flow completes
Then a dedicated screen presents both options as large buttons
And neither option is pre-selected or visually emphasized as the default
```

## Scenario: Logging a set autosaves immediately, with no separate save step

```
Given the user is on the gym logger for an exercise
When they tap to log a set (reps/load or time, and RPE)
Then the set is persisted immediately
And no additional "confirm" or "save" action is required
```

## Scenario: The rest timer starts the instant a set is logged

```
Given the user just logged a set for an exercise with restSeconds = 90
When the set is saved
Then a rest countdown starts immediately from 90 seconds
And no separate action was needed to start it
```

## Scenario: The rest timer announces progress for accessibility

```
Given a rest timer is counting down
When it starts, reaches the halfway point, and reaches zero
Then each of those moments is announced via aria-live
```

## Scenario: The generate-workout button disables itself immediately on tap

```
Given the user taps "Generate today's workout"
When the tap is registered
Then the button becomes disabled immediately
And it re-enables only once a response (success or error) is received
```

## Scenario: The button-disable guard is not the source of quota enforcement

```
Given the client-side button-disable guard could theoretically be bypassed
  (e.g. two separate tabs, each with its own button state)
When two requests reach the server nonetheless
Then the atomic quota increment (docs/features/data-model-rls.md) is what
  prevents exceeding DAILY_GENERATION_LIMIT, not the button state
```

## Scenario: RpeBar is used identically for input and for display

```
Given a set is being logged (input mode) and a past set is being reviewed
  in progress tracking (display mode)
When RpeBar renders in either context
Then it is the same component with a mode prop
And there is no second, separately implemented 1-10 scale control anywhere
  in the codebase
```

## Non-goals (explicitly out of scope)

- Multi-tab/multi-device session conflict detection ("already open
  elsewhere, transfer or continue?"). Deliberately deferred to roadmap —
  see ADR 0008 decision 6.
- Offline sync mechanics for the gym logger. Flagged as a follow-up
  concern, not designed by this feature.
