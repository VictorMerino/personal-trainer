# ADR 0012 — Test strategy per layer

## Status

Accepted

## Context

`docs/PROJECT-BRIEF.md` §8 already fixes coverage thresholds (100% domain/
`shared/utils`, 80% application, 0% infrastructure-direct) and a general
philosophy ("verifiable architecture": pure domain tests without mocks,
tests-after in UI, E2E on critical flows only). What it doesn't fix is *how*
each outer-ring layer gets tested given what's actually hard about this
project: two paid LLM adapters behind the fallback chain (ADR 0005), RLS
policies that are the app's main security guarantee (ADR 0007), and a
multi-step check-in → generate → log → finalize flow with a genuine pause
point (`CHOICE`, ADR 0008/0011). This ADR settles those three, plus what
"critical flow" means concretely for Playwright.

## Decisions

### 1. Domain and `shared/utils`: property-based tests plus explicit example tables, no mocks

Every documented decision table (readiness policy's energy/pain/time matrix,
progression's RPE-vs-target adjustment, DELOAD's set-reduction rule) gets a
hand-written example test per row of the table it's drawn from, so each ADR's
decision is traceable to one assertion. On top of that, `fast-check` property
tests assert the invariants those tables are supposed to guarantee regardless
of input — e.g. "DELOAD never increases prescribed sets relative to the same
inputs under NORMAL," "stall-detection backoff never triggers on the first
session for an exercise," "progression never prescribes a negative load."
Property tests catch edge cases the example tables' author didn't think to
write down; example tables keep the tests legible against the ADRs. Both run
with zero mocks, per the domain layer's "imports nothing" rule (§4) — that's
the whole point of keeping domain pure.

### 2. LLM planner adapters: recorded real-response fixtures, replayed in CI; no live calls on every push

Fixtures (`fixtures/groq-success.json`, `fixtures/groq-malformed-json.json`,
`fixtures/groq-rate-limited.json`, same set for OpenRouter) are captured by
actually calling each provider once via a small manual capture script, then
committed and replayed in unit tests. This tests the adapter's parsing and
Zod-validation logic against real response shapes (real field ordering, real
error envelopes) rather than against a hand-written guess at what the docs
describe — the fixtures can't silently encode the same misunderstanding as
the code under test, because they came from the provider, not from reading
about the provider.

Trade-off accepted deliberately: fixtures can drift if a provider changes
its response shape. Mitigated with a small number of live smoke tests
(happy path only, one per provider) run manually or on a scheduled job, not
on every push — this keeps CI free, fast, and non-flaky while still
surfacing drift within a reasonable window. Recapturing fixtures is a manual
step triggered when a smoke test fails or a provider changelog warrants it,
not automated.

### 3. RLS: Supabase JS client integration tests, not pgTAP

Two authenticated `supabase-js` clients (user A, user B) run against a local
Supabase instance (Docker, spun up in CI) and assert cross-user reads/writes
are rejected or return empty — using the exact client the app itself uses,
with no separate test toolchain. This was discussed against the more
rigorous alternative, pgTAP (SQL-level tests asserting policies directly
inside Postgres, independent of any client-layer bug): pgTAP is the
technically stronger guarantee because it proves the policy holds regardless
of how it's queried, but the app has no raw-SQL access path RLS would need
to guard against that the client tests wouldn't already exercise — every
query the app makes goes through `supabase-js`. Given that, a second SQL
test toolchain is overengineering for the current single-client-path scale
of this project. If a raw-SQL access path is ever introduced (a Postgres
function called outside RLS context, a service-role script, etc.), that's
the trigger to revisit pgTAP — not before.

### 4. E2E (Playwright): golden path plus the CHOICE branch, both as full specs

Two E2E specs, not one:

- **Golden path**: check-in (`NORMAL`/`DELOAD`) → generate → log sets,
  including one incomplete/skipped exercise (ADR 0009) → finalize session.
- **CHOICE branch**: check-in resolves to `CHOICE` → user selects
  `ACTIVE_RECOVERY_WALK` or `REST` → correct minimal plan appears, no
  generate call fires (ADR 0011 decisions 2/4).

`CHOICE` earns its own E2E rather than staying at component-test level
because it's a named decision with a dedicated screen and real branching
across two endpoints (`/api/checkin` → `/api/checkin/:id/choice`) — exactly
the kind of cross-boundary interaction E2E exists to catch that a mocked
component test would paper over. It's also cheap: same check-in fixture
setup as the golden path, one more spec file. Everything else (settings,
profile, limitation history, progress charts) stays at component
(Testing Library) level, per §8's "critical flows only."

### 5. Application layer: real domain, mocked ports

Use cases (`GenerateTodayWorkout`, etc.) are tested with the real domain
logic wired in (no mocking readiness/progression rules — they're cheap and
pure) but fake/mocked `WorkoutPlanner` and repository ports, consistent with
ADR 0005 decision 1's point that a fake failing planner is just an object
whose `tryGenerate` resolves to `{ ok: false, ... }`. This is what §8's 80%
application threshold is measuring against — no live network, no live
Supabase, in this layer.

## Consequences

- Three fixture/test-data sources need to exist and be kept current: domain
  example tables (derived from ADRs, low maintenance), LLM response fixtures
  (manual recapture on drift), and a seeded local-Supabase dataset for RLS
  and E2E specs.
- CI needs Docker-in-CI for local Supabase (RLS tests, E2E) — an addition to
  the pipeline described in §8's Husky/GitHub Actions list, not a
  replacement.
- A recurring (not per-push) job is needed for the LLM live smoke tests —
  worth a line in the eventual CI config, out of scope for this ADR.
- If a raw-SQL / service-role access path is ever added, decision 3 should
  be revisited in favor of pgTAP.

## Alternatives considered

- **Fully hand-mocked LLM adapter tests** — rejected: risks the mock and the
  code sharing the same misreading of the provider's docs, which defeats the
  point of the test. See decision 2.
- **pgTAP for RLS** — rejected for now as overengineering at current scale;
  explicitly a revisit trigger, not a closed door. See decision 3.
- **Golden-path-only E2E, CHOICE at component level** — rejected: cheap to
  add, and CHOICE's cross-endpoint branching is exactly what E2E is for. See
  decision 4.
- **Property tests without example tables (or vice versa)** — rejected:
  example tables keep tests traceable to specific ADR decisions; property
  tests catch what the tables' author didn't think to write. Wanted both.
