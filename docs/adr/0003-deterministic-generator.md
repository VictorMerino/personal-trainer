# ADR 0003 — Deterministic generator: full-body split, LRU rotation, goal-based rep ranges

## Status

Accepted

## Context

The deterministic generator is the last link in the fallback chain
(`docs/PROJECT-BRIEF.md` §7) and must work with **no network dependency** —
it is what guarantees the app never leaves the user with nothing to do, even
with zero AI providers available. It has to turn `(profile, effective
limitations, decision, history)` into a `WorkoutPlan`
(`docs/adr/0002-workout-plan-schema.md`) using only the exercise catalog and
deterministic rules.

This ADR fixes three things: how the session's movement patterns are chosen
(split selection), how a specific exercise is picked once a pattern slot and
equipment/contraindication filter are known (rotation), and how sets/reps
are sized by goal and readiness mode.

## Decisions

### 1. Full-body sessions, not a rotating split — for MVP

Every generated session targets a representative spread of movement
patterns (knee-dominant, hip-dominant, horizontal-push, horizontal-pull,
core, then accessories as time allows), rather than tracking a multi-day
split like upper/lower or push/pull/legs.

**Why, specifically — not just "less work":** a rotating split needs a
notion of "which day of the split is this," which requires either a fixed
weekly training schedule (in tension with the thesis — the plan should adapt
to the day, not assume a fixed calendar) or inferring split position from
attendance history, which is fragile: a few skipped days makes "day 2 of the
split, delayed" ambiguous, and getting that wrong produces a worse
experience than not having a split at all (a session that "expects" a
specific prior session that didn't happen).

Full-body sidesteps this: each session only needs "what's been neglected
lately per pattern" (answered by decision 2's rotation rule), with no
cross-day split state to get out of sync. It also serves the project's own
motivating case better — a user training irregularly around an injury is
better served by "every session is complete and well-rounded" than by a
split assuming consistent multi-day attendance.

**Explicit future extension point, not a limitation to hide:** split
selection is a clean, isolated seam — a function that decides which
patterns to target today. Swapping in a rotating split later touches
nothing else (rotation rule, contraindication filtering, set/rep sizing all
stay as-is). Worth naming this seam in code so the future change is a
drop-in, not a rewrite.

### 2. Exercise selection within a pattern slot: least-recently-used, never random

Once a pattern (e.g. `knee-dominant`) and the equipment/contraindication
filter narrow the catalog to a valid candidate set, the generator picks
whichever valid candidate was used **longest ago** (or never used) by this
user:

```ts
candidates
  .filter(isValidFor(pattern, equipment, effectiveLimitations))
  .sort(byLastUsedAscending)[0]
```

Rejected: random selection among valid candidates. Two reasons: it makes the
"deterministic, demonstrable, testable with no network" link
non-deterministic (same input history could produce different output plans
across runs, which is an odd property for the fallback of last resort to
have), and it actively works against session quality — training is supposed
to have a coherent shape, and picking blind cannot guarantee that in the way
a rule that reasons about recent training history can.

Movement balance *within* one session (not stacking two knee-dominant
exercises back to back, alternating push/pull) is handled by the split's
fixed pattern-priority order (decision 1), not by this rule — LRU only
decides *which* exercise fills an already-decided pattern slot.

### 3. Sets/reps: goal sets the rep range, DELOAD adjusts RPE cap and set count — not the exercises

`UserProfile.goal` is one of three values, each mapping to a rep range for
load- and reps-based exercises:

```ts
const REP_RANGE_BY_GOAL = {
  strength: { min: 4, max: 6 },
  hypertrophy: { min: 8, max: 12 },
  general_fitness: { min: 10, max: 15 },
} as const;
```

`DELOAD` mode does not change which exercises are selected or their rep
range — it caps `rpeTarget` lower (comfortably hard, not near-max effort)
and drops one working set from the normal count, with a floor of 2 sets.
This matches the sports-science definition of a deload: same movement,
deliberately reduced stress, not a different session.

Exact numeric thresholds (the RPE cap value, the floor) are named domain
constants, same pattern as `PAIN_THRESHOLD_BLOCKING` and
`PAIN_STREAK_PROMOTION_DAYS` — no magic numbers, explained in the feature
README.

## Consequences

- Split selection, rotation, and set/rep sizing are three independently
  testable pure functions — none needs the others mocked.
- Rotation requires reading per-exercise "last used" data from history, the
  same history summarisation concern flagged for the LLM planner (design
  item 6) — the deterministic generator needs a lighter version of the same
  input (last-used timestamp per exercise ID is enough; the LLM path needs
  richer volume/RPE summarisation).
- A future rotating-split feature is additive: new split-selection function,
  same rotation rule, same set/rep sizing, same schema.

## Alternatives considered

- **Rotating split (upper/lower, push/pull/legs)** — rejected for MVP, see
  decision 1. Not rejected forever; flagged as a clean future extension.
- **Random exercise selection among valid candidates** — rejected, see
  decision 2.
- **DELOAD swaps to easier exercise variants** instead of reducing RPE/sets
  — rejected: conflates two different concerns (which exercise, vs. how
  hard) and loses the direct sports-science meaning of "deload."
