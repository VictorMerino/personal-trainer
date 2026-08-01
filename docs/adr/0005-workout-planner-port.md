# ADR 0005 — WorkoutPlanner port, shared history summarisation, and three-tier failure handling

## Status

Accepted

## Context

Every link in the degradation chain (Groq → OpenRouter → deterministic
generator, `docs/PROJECT-BRIEF.md` §7) must implement one shared contract so
`FallbackChainPlanner` can treat them interchangeably. That contract needs
two things settled: what it means for a planner call to "fail" (and what the
caller does about it), and what history data every planner receives —
without ever sending raw `SetLog` rows (`docs/PROJECT-BRIEF.md` §6, design
item 6).

The deterministic generator (`docs/adr/0003-deterministic-generator.md`) and
the autoregulation rules (`docs/adr/0004-progression-autoregulation.md`)
already assume access to per-exercise facts (last used, current working
load, stall counter). The LLM path needs a different, more compact view of
the same underlying history. This ADR ties both to one shared computation.

## Decisions

### 1. `WorkoutPlanner.tryGenerate` returns a Result, it does not throw

```ts
interface WorkoutPlanner {
  readonly name: 'groq' | 'openrouter' | 'deterministic';
  tryGenerate(request: PlanRequest): Promise<
    | { ok: true; plan: WorkoutPlan }
    | { ok: false; error: PlannerError }
  >;
}
```

A single failed call — rate limit, timeout, malformed JSON, Zod validation
failure, business-rule rejection (`docs/adr/0002-workout-plan-schema.md`
decision 5) — is a routine, expected outcome, not an exceptional one; it is
the reason the fallback chain exists at all. `FallbackChainPlanner` checks
`result.ok` with a plain `if`, no `try`/`catch`, which also makes it
trivial to test: a fake failing planner is just an object whose
`tryGenerate` resolves to `{ ok: false, ... }`, no thrown-error machinery
needed in any test.

### 2. Exhausting the entire chain throws — this is a genuine bug or incident, not routine

```ts
export class FallbackChainPlanner implements WorkoutPlanner {
  async generate(request: PlanRequest): Promise<WorkoutPlan> {
    for (const planner of this.chain) {
      const result = await planner.tryGenerate(request);
      if (result.ok) return result.plan;
      this.telemetry.record(planner.name, result.error);
    }
    throw new NoPlannerAvailableError();
  }
}
```

The deterministic generator has no network dependency and, by design, has
no reason to fail — if it's in the chain and every link including it
failed, something is actually broken (a bug in the deterministic generator
itself, or a catalog integrity failure). This is exactly the boundary where
an exception is the right tool: unmissable, propagates to error monitoring
(Sentry, `docs/PROJECT-BRIEF.md` §8), and should never be silently
swallowed the way an individual link's failure is.

### 3. Elevated per-provider failure *rate* is a telemetry concern, not part of any single call's control flow

A provider failing occasionally is normal (tier 1). A provider failing
*constantly* over a window of time is a different, real signal — but it is
a trend, not a fact about any one request, so it does not belong in
`tryGenerate`'s return type or in an exception thrown mid-request.
`this.telemetry.record(planner.name, result.error)` (already called on
every tier-1 failure) is the single source both the "which link served this
request" log (§7) and a failure-rate alert are built from — a threshold
check over recorded telemetry, run independently of request handling, not
inline with it.

### 4. One shared `HistorySummary` transformation, read differently by each consumer

```ts
type HistorySummary = {
  perExercise: Record<ExerciseId, {
    lastUsedAt: Date | null;
    currentLoadKg: number | null;
    stallCounter: number;
  }>;
  perPattern: Record<MovementPattern, {
    daysSinceTrained: number | null;
    recentMeanRpe: number | null;
    volume: number;   // total working sets for this pattern in the recent window
  }>;
};

function buildHistorySummary(userId: UserId, since: Date): HistorySummary
```

Computed once, from `SetLog` history, by a single pure domain
transformation with its own tests. The deterministic generator reads
`perExercise` directly for rotation (ADR 0003) and autoregulation (ADR
0004). The LLM prompt serializes only the compact `perPattern` view.

**Why one transformation instead of two independent ones:** splitting it
produces two pieces of logic computing "this user's history" separately,
which can silently drift apart — e.g. a stall-detection fix applied to the
generator's view but not the LLM's, or vice versa, with no test catching the
mismatch because there'd be no shared source of truth to test against. One
function, tested once, read two ways, means both consumers are provably
looking at the same facts.

### 5. Volume is measured as set-count per pattern, not tonnage

`perPattern[pattern].volume` counts total working sets for that pattern
over the recent window (default 14 days), regardless of load. Tonnage
(sets × reps × load) was considered and rejected: it has no defined value
for time-based exercises (no reps or load to multiply) or bodyweight
exercises (no `loadKg`), and computing one would require an invented,
ungrounded bodyweight-to-kg conversion. Set-count is coarser but honestly
measures something computable for every exercise kind, and it's sufficient
for the question it needs to answer: has this pattern been neglected
lately.

## Consequences

- `PlanRequest` includes the pre-computed `HistorySummary`, never raw
  `SetLog` rows — the LLM never sees per-set detail, only the aggregate.
- `FallbackChainPlanner`'s loop, the individual-failure path, and the
  chain-exhausted path are three distinct, independently testable
  behaviors: no mocks needed for any of them (fake planners are plain
  objects; `NoPlannerAvailableError` is asserted with a chain of
  all-failing fakes).
- Failure-rate alerting is a separate piece of infrastructure (reads
  recorded telemetry, not part of any planner or the chain itself) and can
  be built or deferred independently of the port contract.
- `buildHistorySummary` becomes the one place "recent window" (14 days) is
  defined — a named constant, not duplicated across consumers.

## Alternatives considered

- **Throwing on every planner failure, chain catches** — rejected, see
  decision 1: conflates routine, expected outcomes with exceptional ones,
  and complicates testing.
- **Swallowing chain exhaustion silently (e.g. returning a generic empty
  plan)** — rejected, see decision 2: hides a genuine bug behind a
  misleadingly normal-looking outcome, exactly the failure mode structured
  error handling exists to avoid.
- **Checking failure rate inline within `tryGenerate` or the chain loop** —
  rejected, see decision 3: a trend isn't a fact about a single request, and
  inlining it would make the chain's control flow depend on external state
  (recent call history) it doesn't otherwise need.
- **Two independent history transformations** (one for the generator, one
  for the LLM) — rejected, see decision 4.
- **Tonnage as the volume metric** — rejected, see decision 5.
