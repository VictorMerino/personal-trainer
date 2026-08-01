# ADR 0011 — Endpoint contracts, session/quota middleware, and rest-day recording

## Status

Accepted

## Context

This ADR fixes the actual HTTP surface tying together everything designed
so far: check-in submission and `CHOICE` resolution (ADR 0001, ADR 0008),
workout generation and the quota gate (ADR 0005, ADR 0007), set logging and
session finalization (ADR 0009), and progress reads (ADR 0010). It also
closes a gap surfaced while designing this: a `REST` choice has no
`WorkoutPlan` at all, and needs explicit handling so it doesn't silently
look like a missed workout in adherence math.

## Decisions

### 1. Check-in submission and workout generation are separate endpoints, not one combined action

`CHOICE` (ADR 0001 decision 7) creates a genuine pause point — the app
cannot decide whether to generate anything until the user resolves which
option they want. Combining check-in and generation into one call would
mean either blocking mid-request on a UI decision (not possible) or
special-casing `CHOICE` as a different response shape from the same
endpoint (mixes two different response contracts behind one route). Two
endpoints instead:

```
POST /api/checkin
  body: { energy, painReports: [{ zone, level }], availableMinutes, equipmentContext }
  → { decision: TrainingDecision }
  -- TrainingDecision is NORMAL | DELOAD | ACTIVE_RECOVERY | CHOICE (ADR 0001)
  -- NORMAL/DELOAD/ACTIVE_RECOVERY: UI proceeds directly to the next step below
  -- CHOICE: UI shows the walk-vs-rest screen (ADR 0008 decision 2)

POST /api/checkin/:id/choice
  body: { selection: 'ACTIVE_RECOVERY_WALK' | 'REST' }
  → { decision: TrainingDecision }
  -- resolves a CHOICE into a concrete ACTIVE_RECOVERY or a REST outcome (decision 4 below)
```

### 2. `ACTIVE_RECOVERY` never calls a planner or the quota — it's built directly, same as the brief's original pseudocode already states

Per `docs/PROJECT-BRIEF.md` §5 ("the LLM is never called" for
`ACTIVE_RECOVERY`) and ADR 0003's single-block/single-exercise shape,
resolving to `ACTIVE_RECOVERY` (whether directly from severe pain, or via
`CHOICE` → walk) builds the minimal `WorkoutPlan` inline, within the
check-in/choice endpoint itself. There is no separate "generate" call for
this path, and no quota consumed — consistent with the existing design,
not a new rule.

### 3. `NORMAL`/`DELOAD` proceed to a distinct generation endpoint, which is the only place quota and the planner chain are involved

```
POST /api/workouts/generate
  body: {}  -- uses today's already-recorded decision, profile and history; nothing else to send
  → { plan: WorkoutPlan }
```

This is the endpoint named in `docs/PROJECT-BRIEF.md` §7. It performs the
atomic quota increment (ADR 0007 decision 4) first; if the limit is
exceeded, the request is **not an error** — it silently proceeds to the
deterministic generator, consistent with ADR 0007's consequence that a
denied request "falls through to the deterministic generator by the
existing no-provider-available path." The client never needs to handle a
distinct "quota exceeded" case — it always gets back a valid plan.

### 4. A `REST` resolution creates a minimal `workout_plans` row with zero prescribed exercises, excluded from adherence's denominator

Unlike `ACTIVE_RECOVERY`, `REST` has no exercise content at all — there is
nothing to prescribe. To keep this from silently looking identical to "the
user didn't open the app that day" in adherence math (ADR 0010), resolving
`REST` still creates a `workout_plans` row (`mode: 'ACTIVE_RECOVERY'` is
reused as the closest existing mode, with `plan.blocks: []`), and adherence
calculation is updated with one explicit rule: **a `workout_plans` row with
zero prescribed sets is excluded from the adherence denominator entirely**,
not counted as 0/0 or silently dropped. This is a small addendum to ADR
0010's adherence formula, not a redefinition of it.

### 5. Remaining routes, following the same session-verified, Zod-validated pattern

```
POST /api/workouts/:id/sets           -- log a set (autosave, ADR 0008 decision 4)
POST /api/workouts/:id/skip-exercise  -- ADR 0009 decision 2
POST /api/workouts/:id/end            -- ADR 0009 decision 2
GET  /api/progress?range=...          -- ADR 0010, on-demand computation
GET  /api/profile                     -- read profile + limitations
PUT  /api/profile                     -- update goal/level/default equipment
POST /api/profile/limitations         -- add a limitation
PATCH /api/profile/limitations/:id    -- mark active/resolved
```

Auth itself is Supabase's, not a custom endpoint — every route above
verifies the Supabase session server-side before doing anything else
(`docs/PROJECT-BRIEF.md` §9's existing "verified server-side" rule).

### 6. Uniform error shape and status codes; validation failures never leak internals

```ts
type ApiError = { error: { code: string; message: string } };
```

- `401` — no/invalid session.
- `400` — request body fails Zod validation (`docs/PROJECT-BRIEF.md` §9:
  request bodies are validated too, not just LLM responses).
- `404` — referenced resource (a `workout_plans` row, a limitation) doesn't
  belong to the caller or doesn't exist — same response for both, so a 404
  can never be used to probe whether a given ID exists for another user.
- `500` — genuine unexpected failure (includes `NoPlannerAvailableError`
  from ADR 0005 decision 2, which should never happen and is worth a
  distinct logged/alerted case even though the client just sees a 500).
- Quota exceedance is explicitly **not** a status code — see decision 3, it
  is invisible to the client.

## Consequences

- The client-side flow is: `POST /api/checkin` → if `CHOICE`, show the
  screen and `POST /api/checkin/:id/choice` → if the resolved/direct
  decision is `NORMAL`/`DELOAD`, `POST /api/workouts/generate`; otherwise
  (`ACTIVE_RECOVERY` or `REST`), the plan already exists from step 1/2, no
  further call needed.
- `docs/adr/0010-progress-tracking.md`'s adherence formula gains one
  addendum (decision 4 here) — worth a cross-reference edit in that ADR's
  Consequences section.
- Every endpoint's request/response is Zod-validated using schemas already
  designed (`DailyCheckIn`, `WorkoutPlanSchema`, etc.) — no new validation
  approach introduced here.

## Alternatives considered

- **One combined check-in+generate endpoint** — rejected, see decision 1.
- **Returning a distinct "quota exceeded" response to the client** —
  rejected, see decision 3: contradicts the existing silent-fallthrough
  design in ADR 0007/0005.
- **Recording nothing for a REST day** — rejected, see decision 4 (settled
  in discussion before drafting this ADR).
- **Treating `ACTIVE_RECOVERY` the same as `REST` for adherence purposes** —
  rejected: `ACTIVE_RECOVERY` has real prescribed content (one set) and
  behaves like any other plan; only `REST` is genuinely empty.
