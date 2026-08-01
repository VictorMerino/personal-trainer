# ADR 0008 — UI flows: check-in, gym logger, and shared interaction guards

## Status

Accepted

## Context

This ADR fixes the two critical user flows — the daily check-in and the gym
logger — plus two shared interaction concerns raised while designing the
data model (`docs/adr/0007-data-model-rls.md`): preventing accidental
double-submission, and what happens when the same account is active in more
than one place. It also corrects a wording inconsistency: the brief's "four
taps, zero typing" (`docs/PROJECT-BRIEF.md` §2) was always meant as "no
typing, ever" — not a literal count of four button presses, which stopped
being accurate once pain became multi-zone (`docs/adr/0007-data-model-rls.md`
decision 1).

## Decisions

### 1. The check-in is four *steps*, not a literal four taps — pain expands only when needed

Steps, in order: **energy → pain → available minutes → equipment context**.
Each step is answered with buttons, never text input. The pain step
defaults to a single "no pain today" tap for the common case; tapping "yes"
reveals a zone picker (multi-select) where each selected zone opens its own
level picker. On a pain-free day, the whole check-in is still four taps. On
a day with pain in two zones, it's four steps but more than four taps —
which is fine, because the actual constraint the thesis cares about is **no
typing**, not a specific number. `docs/PROJECT-BRIEF.md` §2 should be
reworded from "Four taps, zero typing" to "All-button, zero typing" to stop
implying a literal count.

### 2. A `CHOICE` decision (ADR 0001) is its own screen, not folded into the check-in steps

When `decideTrainingMode` returns `{ kind: 'CHOICE', options: [...] }`
(low energy + low/medium time, ADR 0001 decision 7), the check-in flow ends
normally after step 4, then a dedicated screen presents the two options as
equally-weighted large buttons — "Go for a walk" / "Rest today" — with no
pre-selected default. This is a completed decision, not a sub-step of the
check-in itself, because it needs its own explanation copy (why the app is
asking) that doesn't fit the terse one-question-per-step check-in rhythm.

### 3. The rest timer starts automatically the instant a set is logged

Established in discussion: the moment a user taps to log a set *is* the
start of their rest — there's no separate "start resting" action to
represent, since resting is already happening the moment the set ends. The
timer counts down from that exercise's `restSeconds` (catalog default,
overridable per the `WorkoutPlan` schema's `restSeconds` field), announced
via `aria-live` at key points (start, halfway, done) per the a11y gate
already committed to in `docs/PROJECT-BRIEF.md` §8.

### 4. Every set log is optimistic + autosaved, never a manual "save" step

Logging a set (reps/load-or-time, RPE) writes immediately on tap — no
separate "confirm" or "save" button. This matches "big buttons, autosave"
already stated in the brief's MVP scope (§2) and avoids a state where a
user could lose a logged set by navigating away before an explicit save.

### 5. The "generate workout" button disables itself immediately on tap, re-enabling only on response

Client-side guard against accidental double-submission (a slow network
making a tired user tap twice). This is explicitly **UX polish, not the
quota guarantee** — `docs/adr/0007-data-model-rls.md` decision 4's atomic
DB increment is what actually prevents exceeding `DAILY_GENERATION_LIMIT`;
this button-disable only prevents the *common accidental* case from wasting
a generation or feeling broken.

### 6. Multi-tab/multi-device session conflict detection is explicitly deferred past MVP

The idea (a second tab/device sign-in offers "transfer here or continue
there") is good UX, but requires real-time presence tracking and a session
invalidation mechanism that doesn't exist anywhere else in this design —
it's a genuinely separate engineering problem, not a small addition to the
check-in or logger flows. Building it now would be scope creep relative to
what the MVP needs to prove the thesis. The generate-button quota (decision
5 + ADR 0007 decision 4) already protects against the concrete cost risk
multi-tab use could cause, independent of whether conflict detection
exists. Flagged for the roadmap (`docs/PROJECT-BRIEF.md` §13), not silently
dropped.

### 7. Shared components: `Skeleton`, `Toast`, `RpeBar`

- **`Skeleton`** — loading placeholder for any async view (check-in
  submission, plan generation, progress charts). Used instead of a spinner
  so layout doesn't shift when content arrives.
- **`Toast`** — transient confirmation/error messages (e.g. "Set saved",
  "Offline — will sync when reconnected"). `aria-live` per the a11y gate.
- **`RpeBar`** — the shared 1–10 RPE input/display control, used both when
  logging a set (input) and when reviewing progress (display of past
  values) — one component, two modes, rather than two separate
  implementations of the same 10-point scale.

## Consequences

- `docs/PROJECT-BRIEF.md` §2's "Four taps, zero typing" line needs a wording
  fix to "All-button, zero typing" — tracked as a follow-up edit alongside
  this ADR.
- The `CHOICE` screen is a distinct route/view, not a variant of the
  check-in step component — it has its own copy and its own two-button
  layout.
- Rest timer and autosave both imply the gym logger needs local/offline
  resilience (log a set even on a flaky gym wifi connection, sync when back
  online) — worth a line in the offline/PWA discussion when that's
  designed, not solved by this ADR.
- Multi-tab session conflict detection is a named, deliberate scope
  exclusion — if it's ever revisited, it needs its own design pass (presence
  tracking, invalidation), not a quick addition to this ADR's flows.

## Alternatives considered

- **Literal "four taps" enforced even for multi-zone pain** — rejected: would
  cap pain reporting at one zone, which ADR 0007 decision 1 already rejected
  for the data model; the UI shouldn't re-impose a limit the schema doesn't have.
- **Manual rest-timer start** — rejected, see decision 3.
- **Manual "save" step per logged set** — rejected, see decision 4: already
  contradicts the brief's own "autosave" scope statement.
- **Building multi-tab session-conflict detection now** — rejected, see
  decision 6.
