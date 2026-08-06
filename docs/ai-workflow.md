# AI workflow

How a coding agent was used to build this repo, and what actually went
wrong along the way — not a sanitized retrospective.

## The rhythm

Per `docs/adr/0013-build-plan.md`: pace target of ~10 reviewable PRs/day
instead of a fixed calendar, one PR per feature-spec scenario group, the
agent drafts every PR (including domain logic — deliberately, rather than
hand-writing the "important" parts), the human reviews and merges every
one. Order followed the dependency graph, not ADR numbering: scaffolding →
domain → infrastructure → endpoints → UI → test infra/compliance/docs —
the same six phases this document's own repo history moved through.

Every PR referenced the specific ADR decision(s) and feature-spec
scenario(s) it implemented, and ran the full local gate (lint, typecheck,
tests + coverage thresholds, dependency-boundary check, build) before
being handed off — the reviewer was checking "does this match the spec,"
not deriving what should have been tested from scratch each time.

## What went wrong

**A silent, weeks-old production bug, caught by an E2E test.**
`login.astro` and `onboarding.astro` passed callback props
(`onsignedin`, `onsaved`) to their `client:load` Svelte islands. Astro
serializes island props to JSON to ship them across the server/client
boundary — a function can't survive that. The callbacks silently became
non-functions in the browser (no error, no warning); sign-in never
redirected to onboarding, and saving your profile never redirected home,
in the actual deployed app. This was invisible to every component-level
test, because those tests instantiate the Svelte component directly and
never cross Astro's serialization boundary at all — the exact interaction
E2E exists to catch, and did, the first time a real Playwright test drove
the real page. Fixed by passing a serializable route string instead and
letting the component navigate itself. Now in `AGENTS.md`'s anti-patterns
list.

**A direct commit to `main`.** Mid-build, a change landed directly on
`main` instead of a feature branch — caught, reverted to a proper branch,
and followed up with two Husky hooks (`pre-commit`, `pre-merge-commit`)
that reject the operation locally, since GitHub-side branch protection
isn't available on a private repo without a paid plan. This is the reason
`AGENTS.md` now says to verify `git branch --show-current` before starting
new work, not just after.

**A PR built on top of the wrong open branch.** Forgot to branch from
`main` before starting the next feature, ending up with one feature's
commit sitting on top of a still-open, unrelated branch. Caught during
review; fixed by cherry-picking the commit onto its own branch and
force-pushing the other branch back to its original tip.

**A real cross-user data leak surfaced by asking "what if this runs under
an admin client."** `WorkoutRepository.getPlan(userId, planId)` accepted
`userId` but never filtered by it in the query, relying entirely on RLS.
Safe under the app's normal per-request client — unsafe the moment a
service-role client (exactly what the demo-data seed script uses, since
it writes on behalf of an account it isn't authenticated as) called the
same method, because service-role bypasses RLS entirely. Fixed with an
explicit `.eq('user_id', userId)`, and generalized into a standing
anti-pattern check for any repository method that might ever run under an
elevated client.

**Local-sandbox flakiness that looked like real bugs and wasn't.** While
building the E2E specs, `astro dev` running in this development sandbox
kept leaving orphaned background processes with stale (or missing)
environment variables, which several times produced a convincing but
misleading "sign-in silently fails" symptom that had nothing to do with
the code under test. Diagnosed by checking what a *running* server's
actual behavior was via functional checks (a real login attempt against
it) rather than trusting that "a server is listening on the port" meant
"the right server is listening." Worth naming because it cost real
debugging time before the actual bug (the Astro serialization issue
above) was isolated from this noise.

## What the LLM-generation guardrails actually look like in practice

The "product-level guardrail" named in the README isn't a prompt
instruction asking the model to be safe — it's that the LLM's raw output
(`llm-plan-content.schema.ts`) is deliberately narrower than the full
`WorkoutPlan` it becomes: the model produces `mode` and `blocks`, and
known metadata (`generatedBy`, `schemaVersion`, `promptVersion`) is merged
in afterward rather than trusted from the model's own echo. The
readiness policy (pain guardrail, `CHOICE` outcomes) runs entirely in
domain code before the LLM is ever called; the LLM never decides *whether*
to train around pain, only *what exercises* to prescribe within limits the
domain layer already fixed. If a provider's response fails
`WorkoutPlanSchema.isBusinessValid`, the whole plan is rejected — not
"fixed up" — and the fallback chain (Groq → OpenRouter → deterministic
generator) takes over, so a malformed LLM response degrades to a known-good
non-AI plan rather than a broken one reaching the user.

## What worked

- **Real fixture capture over hand-written guesses**
  (`docs/adr/0012-test-strategy.md` decision 2): both LLM adapters' test
  fixtures came from one real call to each provider, not from reading
  their docs and guessing a shape. This caught real discrepancies — Groq
  returns an HTTP 400 with a structured error envelope on `max_tokens`
  truncation, not a 200 with broken JSON; OpenRouter's chosen default
  model is a *reasoning* model where truncation returns `content: null`,
  not a partial string like Groq's case.
- **Design gaps surfaced as questions, not silent decisions.** Nearly
  every endpoint-phase PR hit at least one real gap the ADRs hadn't
  settled (the daily quota's exact value, the progress range's param
  format, whether a skipped exercise persists, one-limitation-per-zone or
  many). Each was raised explicitly rather than guessed at, which kept
  the human able to correct course before the gap became code.
- **Actually running things instead of trusting static checks.** The RLS
  and E2E test infrastructure (both needing a live local Supabase and, for
  E2E, a live dev server and browser) was run for real before every PR
  that touched it, not just type-checked and assumed correct — which is
  exactly what surfaced both the Astro serialization bug and the
  Playwright hydration-race issue above, neither of which `tsc`/`eslint`
  could ever have caught.
