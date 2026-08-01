# ADR 0004 — Progression and autoregulation: RPE-driven load, stall backoff, conservative reintroduction

## Status

Accepted

## Context

This is the mechanism the brief calls "the heart of the thesis": how logged
RPE (`SetLog`) feeds back into what's prescribed next, how a stuck exercise
gets detected and handled, and how an exercise comes back after a
limitation resolves. All three operate **per exercise**, as an input to how
the deterministic generator sizes that exercise's sets/reps/load
(`docs/adr/0003-deterministic-generator.md`) — not as a session-level
`TrainingDecision` (`docs/adr/0001-readiness-policy.md`).

**Explicit scope note:** the rules below are reasonable MVP defaults
grounded in general training-science principles (progressive overload,
detraining during time off, conservative reintroduction after injury), not
input from a sports-science professional or physiotherapist. They are
documented precisely so they're easy to revisit with expert input later —
see the "Not expert-verified" note in Consequences.

## Decisions

### 1. Readiness-DELOAD and stall-backoff are not the same mechanism

Readiness `DELOAD` (ADR 0001) is a **whole-session, single-day** decision
from today's check-in, with no memory of past sessions. Stall-backoff (this
ADR) is a **per-exercise, multi-session** decision from training history.
They operate at different layers and don't merge: a session can be
`TrainingDecision.NORMAL` while one specific exercise within it is
individually backed off due to a stall, or conversely a readiness-`DELOAD`
session can include an exercise that would otherwise have progressed.

### 2. Autoregulation: compare actual RPE to target RPE, adjust next session's load by a fixed step

After each set, `SetLog.rpe` (actual) is compared to that set's prescribed
`rpeTarget`:

```ts
const RPE_UNDERSHOOT_THRESHOLD = 1.5;  // actual RPE this much below target → too easy
const RPE_OVERSHOOT_THRESHOLD = 1.5;   // actual RPE this much above target → too hard
const LOAD_INCREMENT_PCT = 0.025;      // +2.5% when undershooting

function nextLoad(currentLoadKg: number, avgActualRpe: number, targetRpe: number): number {
  if (avgActualRpe <= targetRpe - RPE_UNDERSHOOT_THRESHOLD) {
    return currentLoadKg * (1 + LOAD_INCREMENT_PCT);   // felt too easy → increase
  }
  return currentLoadKg;   // on target, or too hard → hold, never auto-decrease here
}
```

**Why hold instead of auto-decreasing on overshoot:** a single hard session
isn't itself a problem — fatigue varies day to day, and readiness-DELOAD
already covers "today is a bad day" at the session level. Auto-decreasing
load from a single overshoot would double-count that concern at the wrong
layer. A *sustained* pattern of overshoot (never earning an increase) is a
different, real signal — that's decision 3.

### 3. Stall detection: N consecutive sessions with no load increase triggers one backoff session

```ts
const STALL_SESSIONS_THRESHOLD = 3;
```

If an exercise goes `STALL_SESSIONS_THRESHOLD` sessions in a row without
`nextLoad` ever increasing the load (decision 2's undershoot branch never
firing), the next session for that exercise gets a deliberate, single-session
backoff: `rpeTarget` capped lower and the load held (or reduced slightly),
same mechanical shape as readiness-DELOAD's per-exercise effect from ADR
0003, but triggered by history instead of today's check-in. After the
backoff session, the stall counter resets and normal autoregulation resumes.

### 4. Reintroducing an exercise after a resolved limitation: conservative restart, not a return to the last known load

When a `Limitation` moves from active to resolved, any exercise that was
excluded from selection because of it becomes eligible again. Its first
session back does **not** resume at the load it was at before the
limitation began — it restarts at a reduced fraction of that load, with a
lower `rpeTarget`, and normal autoregulation (decision 2) takes over from
there.

```ts
const REINTRODUCTION_LOAD_FACTOR = 0.8;   // 80% of last known working load
const REINTRODUCTION_RPE_CAP = 6;         // deliberately easy first session back
```

**Why conservative, not resuming where it left off:** time away from a
movement plausibly means reduced capacity for it specifically (detraining),
and re-injury risk is exactly the failure mode this project exists to avoid
(see the project's own thesis origin — a knee injury that existing apps
ignored). Erring conservative costs a session or two of slower progress;
erring aggressive risks the injury recurring. Between those, the safer
default is the correct MVP choice, made explicit precisely so it's easy for
someone with real expertise to revisit later.

Rotation (ADR 0003 decision 2, least-recently-used) naturally re-prioritizes
a just-reintroduced exercise, since it has the oldest (or no) "last used"
timestamp among valid candidates — no special-casing needed there.

## Consequences

- Per-exercise progression state needed: current working load, `rpeTarget`,
  and a rolling stall counter per `(user, exercise)` pair — derived from
  `SetLog` history, not stored as separate mutable state, so it's always
  recomputable from source data.
- All five constants introduced here
  (`RPE_UNDERSHOOT_THRESHOLD`, `RPE_OVERSHOOT_THRESHOLD`, `LOAD_INCREMENT_PCT`,
  `STALL_SESSIONS_THRESHOLD`, `REINTRODUCTION_LOAD_FACTOR`,
  `REINTRODUCTION_RPE_CAP`) are named domain constants, explained in the
  feature README, same pattern as the readiness and catalog constants.
- **Not expert-verified:** the specific numeric thresholds and the
  conservative-reintroduction default are the product owner's (a potential
  user, not a sports-science professional) best-effort MVP defaults. Worth
  a roadmap note: revisit with input from a coach or physiotherapist once
  the app has real usage data, rather than presenting these numbers as
  clinically validated.
- `decideTrainingMode` (ADR 0001) remains entirely unchanged by this ADR —
  progression operates one layer below it, in the deterministic generator's
  per-exercise sizing step.

## Alternatives considered

- **Merging stall-backoff into `TrainingDecision.DELOAD`** — rejected, see
  decision 1: conflates a whole-session daily signal with a per-exercise
  multi-session one.
- **Auto-decreasing load on any single overshoot** — rejected, see decision
  2: double-counts a concern readiness-DELOAD already covers, and would
  make one hard set overreact into a permanent load cut.
- **Resuming a reintroduced exercise at its last known load** — rejected,
  see decision 4: ignores plausible detraining and reintroduces the exact
  re-injury risk the project exists to guard against.
