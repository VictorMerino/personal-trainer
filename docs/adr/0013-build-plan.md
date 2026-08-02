# ADR 0013 — Build plan: PR ordering and delegation rhythm

## Status

Accepted

## Context

Design is complete (ADRs 0001–0012). This ADR turns that design into an
actual build sequence: what order ~30 PRs get built in, and how work is
split between the coding agent and the human reviewer. Original framing was
a 4-week calendar; in discussion this was replaced with a pace target
instead — the calendar isn't the constraint, throughput is.

## Decisions

### 1. Pace, not calendar: target ~10 reviewable PRs/day, adjust after day 1

No fixed week-by-week schedule. Each PR is scoped to one feature-spec
scenario group (small enough to review same-day), drafted by the agent from
its `docs/features/*.md` spec, and merged only after human review —
"COMMITTING THE CODE IS HUMAN WORK" applies to every PR, not a subset. Day 1
is a calibration run at the recommended rhythm below; the split is revisited
after it if review actually bottlenecks at that volume.

### 2. Delegation rhythm: agent drafts every PR, human reviews every PR — uniformly, no layer exception

Applied to all layers, including domain — rejecting the alternative of the
human hand-writing domain code directly. Reasoning: with the domain layer's
example tables and property tests already specified (ADR 0012 decision 1)
and its rules already pinned down in ADR 0004, the agent has an
unusually complete spec to draft against there, so the marginal safety of
hand-writing it doesn't clearly beat catching mistakes in review — and a
uniform rhythm produces one consistent AGENTS.md correction history instead
of two different working styles to document.

### 3. PR ordering follows the dependency graph, not the numbered ADR list

Build order groups by what unblocks what, not ADR sequence number:

1. **Scaffolding** (~4 PRs) — project init (Astro+Svelte+TS strict+pnpm),
   quality gates (ESLint+Sonar+`eslint-plugin-boundaries`+
   `dependency-cruiser`, Husky hooks), Supabase project + migrations (ADR
   0007 schema, RLS policies), GitHub Actions pipeline skeleton.
2. **Domain** (~6 PRs) — exercise catalog data + integrity tests (ADR
   design item 1), readiness policy (ADR 0001), `WorkoutPlan` Zod schema
   (ADR 0002), deterministic generator (ADR 0003), progression/
   autoregulation (ADR 0004), `WorkoutPlanner` port + `FallbackChainPlanner`
   (ADR 0005). This is the no-AI working core — matches §12's original
   "first four give a fully working app with no AI at all" framing, now
   folded into one ordered domain phase.
3. **Infrastructure** (~5 PRs) — prompt construction (ADR 0006), Groq
   adapter, OpenRouter adapter (both against the recorded fixtures from ADR
   0012 decision 2), `SupabaseWorkoutRepository`, seed script (§9).
4. **Endpoints** (~5 PRs) — checkin+choice, generate, sets/skip/end,
   progress, profile (all per ADR 0011).
5. **UI** (~7 PRs) — shared components (`Skeleton`/`Toast`/`RpeBar`) first
   since everything else depends on them, then onboarding, check-in flow,
   `CHOICE` screen, session/logging screen + rest timer, progress charts.
6. **Test infra + compliance + docs** (~4 PRs) — RLS/E2E Supabase-in-CI
   setup, LLM fixture capture script, health-data compliance ADR +
   disclaimer (§11), README/`AGENTS.md`/`docs/ai-workflow.md`.

Phase 2 (domain) is buildable and independently testable before phase 3
exists at all, which is the point of the dependency rule in §4 — this
ordering is a direct consequence of that rule, not a separate scheduling
decision.

### 4. Each PR ships with its test plan already decided, not discovered during review

Every PR references the specific `docs/features/*.md` scenarios it
implements and the specific layer-testing approach from ADR 0012 that
applies to it (e.g. "implements the DELOAD example rows + one property test
per decision 1"). This is what makes ~10 PRs/day realistic: the reviewer is
checking "does this match the spec and the agreed test approach," not
deriving what should have been tested from scratch each time.

## Consequences

- `docs/ai-workflow.md` (§10) gets its material for free as a side effect
  of this rhythm — every PR is a data point on what the agent got right or
  wrong against a spec it was handed, without extra logging work.
- If review genuinely bottlenecks below ~10 PRs/day after day 1, the fallback
  is coarsening PR granularity (combine adjacent phase-2 domain PRs) before
  loosening the review-every-PR rule — the rule itself is not up for
  revision without discussing why first.
- No calendar deadline is recorded here deliberately; §12 is now fully
  designed and this ADR is the last "still to be designed" item, so from
  here the repo's own PR history becomes the schedule of record.

## Alternatives considered

- **Fixed 4-week calendar with week-by-week milestones** — rejected in
  discussion: the constraint is throughput, not dates, and a calendar with
  slipping weekly milestones would need constant revision anyway.
- **Human writes domain code by hand, agent does the rest** — rejected: see
  decision 2. Domain has the most complete spec of any layer, which cuts
  against needing the extra hand-written safety margin.
- **Review at phase boundaries instead of per-PR** — rejected: batching
  review across ~5-7 PRs per phase risks a bad pattern (e.g. a boundary
  violation) repeating silently across several PRs before being caught.
