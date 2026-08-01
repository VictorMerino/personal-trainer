# ADR 0009 — Incomplete sets, skipped exercises, and session finalization

## Status

Accepted

## Context

Neither the `SetLog` shape (`docs/adr/0007-data-model-rls.md`) nor the gym
logger flow (`docs/adr/0008-ui-flows.md`) previously distinguished "hasn't
gotten to this set yet, still mid-workout" from "chose to stop here." Both
look identical as an absence of a `SetLog` row, which breaks adherence
tracking (explicit MVP scope, `docs/PROJECT-BRIEF.md` §2 item 5) and
autoregulation's read of "what actually happened" (`docs/adr/0004-progression-autoregulation.md`).

This ADR fixes two genuinely different situations:

1. **A set was attempted but fell short** (e.g. 8 prescribed, 6 completed) —
   already representable, no schema change.
2. **A set, exercise, or the rest of the session was never attempted** —
   not previously representable at all.

## Decisions

### 1. A short-of-prescription set needs no new field — `actual_reps` differing from the plan already captures it

`SetLog.actual_reps` (or `actual_seconds`) is independent of the prescribed
target; logging 6 reps against a prescribed 8 already tells the whole
story, especially combined with a high logged RPE (9–10, "couldn't do
another rep"). This is not a new decision, it's a confirmation that
decision 2's new "skipped" concept is for something else entirely — an
attempt that fell short is not a skip.

### 2. Explicit "skip this exercise" and "end session" actions — inferred completion (e.g. from elapsed time) is rejected outright, not just deprioritized

A rep-based workout has no reliable time signature: a long gap since the
last logged set could mean a long rest after a heavy final set, not an
abandoned session. There is no time threshold that could distinguish those
cases correctly, so inferring completion from elapsed time isn't a
simpler-but-worse option — it's not a working option at all. Two explicit
actions are needed instead:

```sql
alter table workout_plans
  add column ended_at timestamptz,       -- null = still in progress
  add column ended_reason text check (ended_reason in ('pain', 'time', 'other'));
```

- **Skip this exercise** — available per exercise in the gym logger. Any
  remaining unlogged prescribed sets for *that exercise* are marked
  skipped; the user moves to the next exercise in the plan. The rest of
  the session is unaffected.
- **End session** — finalizes the whole workout (`ended_at` set). Any
  prescribed set across *any* exercise with no `SetLog` row at that point
  is recorded as skipped. Before this action, an absent `SetLog` row means
  "not reached yet," not skipped — this is the only way adherence tracking
  can tell the two apart.

Both actions accept the same optional single-tap reason:
`'pain' | 'time' | 'other' | null`.

### 3. The reason tag is informational only — it never retroactively changes today's TrainingDecision or auto-modifies a Limitation

Selecting "pain" as the stop reason does not reopen or revise the
`TrainingDecision` already made at check-in time (`docs/adr/0001-readiness-policy.md`)
— that decision was made from the information available then, and this ADR
doesn't introduce a mechanism to retroactively edit a completed decision.
It also does not automatically create or escalate a `Limitation`. It's
purely a note surfaced back to the user in their own progress view (e.g.
"you've stopped early due to pain 3 times this month") — a signal a human
can act on deliberately (e.g. by adding a limitation via the profile,
already-designed flow), not one the system acts on by itself.

**Why not auto-escalate to a Limitation on repeated pain-tagged stops:**
this would be the same mistake ADR 0001 decision 8 already rejected for
pain streaks in check-ins — the system silently making a standing decision
about the user's body without their explicit confirmation. Consistency
with that precedent matters more than the marginal convenience of
automating it.

## Consequences

- `SetLog` rows for a "skipped" set are **not created at all** — a skip is
  the *absence* of a row, made meaningful only by `ended_at` (or a
  per-exercise skip marker) establishing that absence was deliberate, not
  incomplete. No `status: 'skipped'` row type needed on `SetLog` itself.
- Adherence calculation (progress tracking, `docs/PROJECT-BRIEF.md` §2 item
  5 — still not otherwise formally designed) can now be defined precisely:
  for any `ended_at`-finalized `WorkoutPlan`, adherence = logged sets ÷
  prescribed sets. An in-progress (`ended_at IS NULL`) plan is excluded
  from adherence math entirely, not counted as 0%.
- `HistorySummary`'s `perExercise`/`perPattern` views (`docs/adr/0005-workout-planner-port.md`)
  should only read from finalized sessions when computing "days since
  trained" — an abandoned, unfinalized session shouldn't be silently
  treated as a completed one.
- Per-exercise skip needs its own UI affordance in the gym logger, alongside
  (not replacing) the existing autosave-per-set flow from ADR 0008.

## Alternatives considered

- **Inferring session completion from elapsed time** — rejected outright,
  see decision 2: no reliable threshold exists for rep-based training.
- **A `status` field on individual `SetLog` rows to represent skips** —
  rejected: a skip is better modeled as an absent row plus a finalization
  timestamp than as a row representing something that didn't happen.
- **Auto-creating or escalating a `Limitation` after repeated pain-tagged
  stops** — rejected, see decision 3, for consistency with ADR 0001
  decision 8's precedent against silent limitation changes.
