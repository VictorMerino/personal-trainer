# Feature: Readiness policy

Decides today's training mode from the daily check-in, before any AI call.
See `docs/adr/0001-readiness-policy.md` for the rationale behind every rule
below — this document specifies behavior, the ADR explains why.

Domain function under spec: `decideTrainingMode(checkIn: DailyCheckIn): TrainingDecision`.

## Background

```
Given the exercise catalog and Limitation model already exist
And a user has an UserProfile with zero or more active Limitations
```

## Scenario: Severe pain always forces active recovery

```
Given the user reports pain level "severe" in any zone during check-in
And energy is "high"
And available time is "high"
When decideTrainingMode is called
Then the result is { kind: 'ACTIVE_RECOVERY' }
And the LLM planner is never invoked
```

## Scenario: Moderate pain forces a deload regardless of energy or time

```
Given the user reports pain level "moderate" in any zone
And energy is "high"
And available time is "high"
When decideTrainingMode is called
Then the result is { kind: 'DELOAD' }
```

## Scenario: Today's pain merges with a stored limitation, taking the higher severity

```
Given the user's profile has an active Limitation { zone: "knee", severity: "mild" }
And today's check-in reports pain { zone: "knee", level: "severe" }
When the effective limitations for today are computed
Then the knee limitation used for exercise filtering has severity "severe"
And the stored profile Limitation is unchanged
```

## Scenario: Same-day pain in a zone with no stored limitation still filters exercises

```
Given the user's profile has no limitation for the "shoulder" zone
And today's check-in reports pain { zone: "shoulder", level: "moderate" }
When the effective limitations for today are computed
Then a "shoulder" limitation with severity "moderate" is included
And it is used by the contraindication policy exactly like a stored limitation
```

## Scenario: Today's pain does not silently carry forward without confirmation

```
Given yesterday's check-in reported pain { zone: "knee", level: "moderate" }
And today's check-in is submitted with pain { zone: "knee", level: "none" }
When the effective limitations for today are computed
Then no "knee" limitation is included from yesterday's pain
And only today's confirmed value is used
```

## Scenario: Yesterday's pain pre-fills today's check-in, but requires confirmation

```
Given yesterday's check-in reported pain { zone: "knee", level: "moderate" }
And the user opens today's check-in and has not yet answered the pain question
When the pain step of the check-in renders
Then the zone "knee" and level "moderate" are pre-selected as the default
And the user must confirm or change the value before it is submitted
And decideTrainingMode only runs once today's value is confirmed, never on the pre-fill alone
```

## Scenario: A pain streak suggests promoting it to a standing limitation

```
Given the user has reported pain level "mild" or higher in the "knee" zone
  for PAIN_STREAK_PROMOTION_DAYS consecutive check-ins
And the profile has no active "knee" limitation
When today's check-in is submitted
Then the app surfaces a suggestion to add a standing "knee" limitation
And declining the suggestion does not change any limitation
And the streak continues to be tracked if the user declines
```

## Scenario: Accepting a pain-streak suggestion creates a real limitation

```
Given the app has surfaced a promotion suggestion for the "knee" zone
When the user accepts it
Then a new active Limitation { zone: "knee" } is created on the profile
  via the standard onboarding/profile mechanism
And future check-ins no longer need to re-report knee pain for it to be
  accounted for in filtering, since it is now a stored Limitation
```

## Scenario: Low energy with plenty of time routes to active recovery, not a smaller workout

```
Given pain is "none" everywhere
And energy is "low"
And available time is "high"
When decideTrainingMode is called
Then the result is { kind: 'ACTIVE_RECOVERY' }
```

## Scenario: Medium energy always deloads regardless of time

```
Given pain is "none" or "mild"
And energy is "medium"
When decideTrainingMode is called
Then the result is { kind: 'DELOAD' }
```

## Scenario: High energy with little time still trains, just time-boxed

```
Given pain is "none" or "mild"
And energy is "high"
And available time is "low"
When decideTrainingMode is called
Then the result is { kind: 'NORMAL' }
And the plan is sized to fit the available time
```

## Scenario: High energy with medium or high time trains normally

```
Given pain is "none" or "mild"
And energy is "high"
And available time is "medium" or "high"
When decideTrainingMode is called
Then the result is { kind: 'NORMAL' }
```

## Scenario: Low energy with little time is ambiguous — the app asks, it doesn't decide

```
Given pain is "none" or "mild"
And energy is "low"
And available time is "low" or "medium"
When decideTrainingMode is called
Then the result is { kind: 'CHOICE', options: ['ACTIVE_RECOVERY_WALK', 'REST'] }
And no workout plan is generated until the user resolves the choice
And the UI presents both options as equally valid, with no default selection
```

## Scenario: Resolving a CHOICE towards a walk behaves like active recovery

```
Given decideTrainingMode returned { kind: 'CHOICE', options: [...] }
And the user selects "ACTIVE_RECOVERY_WALK"
When the use case proceeds
Then it behaves as if the result had been { kind: 'ACTIVE_RECOVERY' }
```

## Scenario: Resolving a CHOICE towards rest produces no workout, without an empty screen

```
Given decideTrainingMode returned { kind: 'CHOICE', options: [...] }
And the user selects "REST"
When the use case proceeds
Then no workout plan is generated
And the UI shows a rest-day acknowledgment, not a blank state
```

## Non-goals (explicitly out of scope)

- Therapeutic / rehab-style progressive loading for an injured zone. The
  policy avoids aggravating a limitation; it does not treat one. See ADR
  0001 for the reasoning.
- Overriding the severe-pain hard gate. No override path exists in the MVP.
- Automatically promoting a pain streak to a `Limitation` with no user
  confirmation. The app only ever suggests; the user decides.
- Using unconfirmed pre-filled pain values in filtering. Only a value the
  user has explicitly confirmed for today feeds `decideTrainingMode`.
