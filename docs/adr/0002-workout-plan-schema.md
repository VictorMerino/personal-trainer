# ADR 0002 — WorkoutPlan schema: per-set prescription, and reject-whole-plan on business violation

## Status

Accepted

## Context

`WorkoutPlan` is both the LLM's output contract and the deterministic
generator's output — the same shape must serve both, since the whole point
of the fallback chain (`docs/PROJECT-BRIEF.md` §7) is that every link is
interchangeable behind one port. It also has to survive Zod validation
catching a syntactically valid but business-invalid response (an exercise ID
outside the permitted filtered set, or one contraindicated for the user).

This ADR fixes the shape of `WorkoutPlan` and what happens when validation
fails after parsing succeeds.

## Decisions

### 1. `SetTarget` is a discriminated union keyed by progression kind, not one shared shape with optional fields

The catalog's `progression` field is `'load' | 'reps' | 'time'` per exercise
(a squat progresses by load, a plank by time). A set's prescription mirrors
that:

```ts
type SetTarget =
  | { kind: 'load'; reps: Range; loadKg: number; rpeTarget: number }
  | { kind: 'reps'; reps: Range; rpeTarget: number }
  | { kind: 'time'; seconds: number; rpeTarget: number };
```

Rejected: one shape with all fields optional (`{ reps?, loadKg?, seconds?,
rpeTarget }`). It would let a Zod-valid set carry a `loadKg` on a
time-based exercise (a plank with a weight target makes no sense) — a class
of bug the type system should rule out, not one deferred to a runtime check.
The union costs a `switch (set.kind)` everywhere a `SetTarget` is consumed
(UI, generator, response validator); that's a single flat branch, not
nested, so it doesn't touch the Sonar `no-nested-conditional` /
cognitive-complexity budget.

### 2. `sets` is an array of individual `SetTarget`s, not `{ count, target }`

Sets within one exercise can differ from each other — a ramping set scheme
(lighter first set, heaviest last) is normal training practice, not an edge
case. Repeating an identical `SetTarget` object N times for the common "3×8
same weight" case is the accepted cost of this expressiveness. This also
sets up progression/autoregulation (design item 5, "the heart of the
thesis") to eventually prescribe per-set adjustments, not just per-exercise
ones.

### 3. `ACTIVE_RECOVERY` plans reuse `WorkoutPlanSchema`, not a separate type

An active-recovery session is just a plan with one block (`role: 'main'`),
one cardio or mobility exercise, and a single `{ kind: 'time', seconds,
rpeTarget }` set — consistent with "cardio in the MVP is duration + RPE
only" (`docs/PROJECT-BRIEF.md` §2). No parallel schema, no special-casing in
the validator.

### 4. `generatedBy` and `schemaVersion` are persisted on the plan itself

`generatedBy: 'groq' | 'openrouter' | 'deterministic'` records which link in
the fallback chain actually served the plan — turns "Groq down → OpenRouter
served it" from a log line into a queryable fact per plan.
`schemaVersion` ties the persisted shape to the prompt version that produced
it (design item 7), so a future schema change doesn't retroactively
misinterpret older stored plans.

### 5. A business-rule violation on an otherwise Zod-valid plan rejects the whole plan — it is never pruned

If a plan parses but references an exercise outside the permitted,
already-filtered subset (or, in principle, any other business rule), the
entire plan is discarded. The `FallbackChainPlanner` treats this exactly
like a parse failure — "this link failed" — and moves to the next link.
Nothing is patched or partially kept.

```ts
const parsed = WorkoutPlanSchema.safeParse(raw);
if (!parsed.success) return { ok: false };
if (!isBusinessValid(parsed.data, permittedExerciseIds)) {
  return { ok: false }; // whole plan discarded, not patched
}
return { ok: true, plan: parsed.data };
```

**Why not prune just the offending exercise(s) and keep the rest:** the
degradation chain already guarantees a usable plan reaches the user — the
deterministic generator has no network dependency and always succeeds, so
pruning buys nothing that the chain doesn't already provide. Pruning would
also introduce a second, weaker notion of "valid" (a patched plan with its
own edge cases — what if pruning empties a block? what if it unbalances the
session?) purely to avoid a fallback call that's already free of cost or
risk. Rejecting keeps one guarantee simple: **a plan the user sees was
either fully valid as generated, or fully valid as a deterministic
fallback — never a partial patch-up.**

## Consequences

- Every consumer of `SetTarget` (UI rendering, deterministic generator,
  LLM-response validator) branches on `kind` via a flat `switch`.
- `isBusinessValid` (exercise-ID permitted-set check, contraindication
  re-check) is a separate step from `WorkoutPlanSchema.safeParse` — schema
  validity and business validity are deliberately two different checks with
  two different failure modes, both routed the same way into "link failed."
- No partial/pruned plan type ever needs its own tests or its own UI
  handling — one less state to design for.
- `ACTIVE_RECOVERY` needs no separate rendering logic distinct from a
  single-block, single-exercise `NORMAL`/`DELOAD` plan.

## Alternatives considered

- **Shared `SetTarget` shape with optional fields** — rejected, see decision 1.
- **`sets: { count, target }`** — rejected, see decision 2: can't express
  ramping/varied sets, which is normal training practice.
- **Separate `ActiveRecoveryPlan` type** — rejected, see decision 3: needless
  duplication for a case the existing shape already covers.
- **Prune offending exercises, keep the rest of the plan** — rejected, see
  decision 5.
