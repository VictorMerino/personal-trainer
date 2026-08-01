# ADR 0001 — Readiness policy: energy, pain and time decide the training mode

## Status

Accepted

## Context

The thesis of the project is that the plan adapts to the user every day. That
adaptation cannot live inside an LLM prompt — it must be a deterministic,
testable domain rule that runs *before* any AI call, so it is provable and
demonstrable with no network involved (see `docs/PROJECT-BRIEF.md`, sections
5 and 7).

The daily check-in collects four signals: energy, pain (zone + level),
available minutes, and equipment context. This ADR fixes how the first three
combine into a `TrainingDecision`, and how pain history is used across days.
Equipment context is a catalog-filtering concern, not a mode-selection
concern, and is out of scope here.

## Decisions

### 1. Energy is a 3-level scale, not 5

`low | medium | high`. A "traffic light" tap, not a fine-grained self-report.
Five levels (e.g. depleted..great) were considered and rejected: the
difference between adjacent levels is not meaningful enough for a user to
reliably self-report in a 2-second tap, and it doesn't change what the app
does differently. Three levels is the coarsest scale that still lets the app
make distinct decisions.

### 2. Pain reuses the same 4-value scale as `Limitation.severity`

`none | mild | moderate | severe`. Rejected a numeric 0–10 scale: it would
require a second bucket-to-severity mapping function to reconcile with
`Limitation`, doubling the vocabulary and the surface for the two to drift
out of sync. One scale, one mapping, one set of tests.

### 3. Today's pain merges into that day's effective limitations — filtering never auto-persists it

Check-in pain is combined with the user's stored `Limitation[]` by taking the
**max severity per zone**, recomputed fresh on every check-in. It is not
silently promoted to a new chronic limitation and does not by itself continue
to restrict exercise selection on a day it wasn't reported.

```ts
function effectiveLimitationsForToday(
  profile: readonly Limitation[],
  checkIn: DailyCheckIn,
): readonly Limitation[]
```

The merged result feeds the exact same `contraindication-policy` used for
chronic limitations — there is no second, parallel filtering path for
same-day pain.

This is deliberately not the same as "the app forgets it happened." Past
check-in pain is retained (it's already part of the persisted `DailyCheckIn`
history used for progress tracking) and used in two ways that stop short of
silently driving today's filtering — see decision 8.

**Why merge instead of treating them as independent signals:** the whole
point of daily readiness is that today's state can differ from the stored
baseline in either direction — a new ache the profile doesn't know about, or
an old injury that happens to feel fine today. Recomputing fresh each time
keeps the model honest to "the plan adapts to you, every single day" instead
of accumulating stale state.

**Explicit non-goal — this is not rehab:** treating pain as a limitation
means the catalog excludes exercises above the allowed stress ceiling for
that zone; it does not attempt therapeutic loading (deliberately reinforcing
a joint through controlled, progressive exercise, the way a physiotherapist
would). That is a supervised-rehab problem, not a check-in-form problem, and
doing it without a clinician's judgment in the loop would be irresponsible.
The existing severity → max-stress thresholds (mild → moderate stress still
allowed, moderate → low, severe → none) already avoid blanket avoidance of a
whole pattern; going further than that is out of MVP scope. The medical
disclaimer states this boundary explicitly.

### 4. Pain is a hard gate for MVP — severe pain always forces `ACTIVE_RECOVERY`

Regardless of energy or available time, a severe pain reading in any zone
routes to `ACTIVE_RECOVERY` and the LLM is never called. This is the
simplest, safest default and matches the guardrail-in-the-domain pattern
already established for the catalog.

This is explicitly **not** written in stone: a future version may let a user
consciously override the gate ("I know my body, let me train anyway") as an
explicit, logged acknowledgment — never a silent bypass. That is a roadmap
item, not MVP.

### 5. Time is an input to *mode*, not only to volume

Energy and available time interact to decide the *shape* of the session, not
just its size:

- High energy + little time → still a real strength session, just short and
  dense (`NORMAL`, time-boxed) — not a deload.
- Low energy + plenty of time → not a smaller strength session, but a
  different kind of session entirely (a long walk, `ACTIVE_RECOVERY`).

Available minutes therefore participates in `decideTrainingMode` itself,
alongside energy and pain — it is not applied only afterward to size the
plan.

### 6. Decision table

| Pain | Energy | Time | → Mode |
|---|---|---|---|
| severe (any zone) | any | any | `ACTIVE_RECOVERY` |
| moderate | any | any | `DELOAD` |
| none / mild | low | low or medium | `CHOICE` (walk vs. rest — see §7) |
| none / mild | low | high | `ACTIVE_RECOVERY` (long walk) |
| none / mild | medium | any | `DELOAD` |
| none / mild | high | low | `NORMAL`, time-boxed |
| none / mild | high | medium or high | `NORMAL` |

### 7. Ambiguous cells resolve as a domain-level `CHOICE`, not a UI branch

Low energy + low/medium time, with no meaningful pain, doesn't have a single
correct answer — a short walk and an honest rest day are both legitimate.
The app never unilaterally decides "rest" for a user who opened the app to
train (that would feel like a dismissal, not a recommendation), but it also
must never leave the user with an empty screen.

`decideTrainingMode` therefore returns a fourth outcome kind:

```ts
{ kind: 'CHOICE', options: ['ACTIVE_RECOVERY_WALK', 'REST'] }
```

**Why this lives in the domain, not the UI:** deciding that a given
combination of inputs is ambiguous is itself a business rule, exactly like
deciding it's a deload. Pushing it into a component or a pre-check-in screen
would split readiness logic across two layers and violate the project's own
dependency rule (`ui → application → domain`, domain owns all business
rules). Keeping it in the domain means the ambiguity is asserted the same
way every other outcome is: given a `DailyCheckIn`, with no network and no
UI, `decideTrainingMode` returns `{ kind: 'CHOICE', ... }`.

### 8. Check-in pain history is retained, and used for pre-fill and streak detection — never to silently drive today's filtering

Two read-only uses of past `DailyCheckIn` pain, both stopping short of
auto-applying anything:

- **Pre-fill, not auto-apply.** Today's check-in defaults the pain
  zone/level to yesterday's reported value, since recurring pain is the
  common case ("probably you'll have it tomorrow"). It is still a default,
  not a decision — the user taps to confirm or change it, and only the
  *confirmed* value for today feeds `effectiveLimitationsForToday`. A user
  whose pain resolved is never silently held to yesterday's restriction
  because they forgot to update it — they have to see and confirm the
  pre-filled value each day.
- **Streak detection → promotion suggestion.** If the same zone is reported
  with pain ≥ `mild` for `PAIN_STREAK_PROMOTION_DAYS` consecutive check-ins
  (a named domain constant, default 3 — tune post-MVP with real data), the
  app surfaces a suggestion: "this looks ongoing — add it as a standing
  limitation?" Accepting creates a real `Limitation` on the profile via the
  existing onboarding/profile mechanism; declining does nothing and the
  streak keeps being tracked. This is the actual mechanism that turns a
  recurring signal into something that stops requiring daily re-entry — and
  it's explicit, user-confirmed, never silent.

**Why not just auto-persist pain as a limitation after N days:** that would
reintroduce exactly the staleness problem decision 3 avoids — an
auto-created limitation is one more piece of state a "resolved" flag has to
catch up with, and it removes the user from a decision about their own body
that they should make consciously. Suggesting, not deciding, keeps the
guarantee that any standing limitation impacting every session's filtering
was something the user actively confirmed.

## Consequences

- `TrainingDecision` is a 4-variant discriminated union:
  `NORMAL | DELOAD | ACTIVE_RECOVERY | CHOICE`.
- The application layer (`generate-today-workout` use case) must handle
  `CHOICE` by surfacing it to the UI instead of calling the planner; the
  planner is only invoked once a concrete mode is known (either directly, or
  after the user resolves a `CHOICE`).
- `decideTrainingMode` remains fully testable with plain objects — no mocks,
  no network, matching the "verifiable architecture" testing philosophy in
  `docs/PROJECT-BRIEF.md` §8.
- The pain-as-hard-gate rule (decision 4) should be revisited once user
  feedback exists; tracked as a roadmap item, not blocking MVP.
- Requires reading recent `DailyCheckIn` history (at least the last
  `PAIN_STREAK_PROMOTION_DAYS` entries per zone) at check-in time, for
  pre-fill and streak detection — a small query, not a new entity.
- `PAIN_STREAK_PROMOTION_DAYS` is a named domain constant, alongside
  `PAIN_THRESHOLD_BLOCKING` and the intensity caps — no magic numbers.

## Alternatives considered

- **5-level energy scale** — rejected, see decision 1.
- **Numeric pain scale (0–10)** — rejected, see decision 2.
- **Pain history not retained at all** — rejected: loses the "you'll
  probably still have it tomorrow" signal entirely, forcing a full re-tap
  from a blank default every day and no way to notice a recurring pattern.
- **Auto-persisting pain as a limitation after N days with no confirmation**
  — rejected, see decision 8.
- **Independent pain/limitation signals** (pain only feeds the blocking gate,
  never touches per-exercise filtering) — rejected: would leave acute,
  non-chronic pain below the blocking threshold completely unfiltered from
  exercise selection, undermining the "this hurts today, work around it"
  thesis.
- **Time as post-hoc volume scaling only** — rejected, see decision 5: it
  cannot express "low energy + lots of time → walk, not a smaller lift."
- **UI-level branch for the ambiguous low-energy/low-time cell** — rejected,
  see decision 7.
