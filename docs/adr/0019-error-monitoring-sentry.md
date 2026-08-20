# ADR 0019 — Error monitoring with Sentry

## Status

Proposed

## Context

The app has no error monitoring today: a production failure (an LLM
planner erroring, a Supabase call failing, an unhandled exception in an
API route) is only visible by manually reading Vercel function logs —
already the case for the two production bugs fixed this session (the
deprecated Groq model, the SSR relative-URL fetch). There's no way to
learn about a failure without deliberately going looking for it.

A prior project on the same stack (Astro + `@astrojs/vercel`, deployed
to Vercel) went through a real incident getting Sentry working
correctly: events were captured but silently never reached Sentry, with
no error or log indicating why. The root cause and the checklist for
ruling out the false leads are documented in an artifact ("The Missing
Flush", 2026-08-20) and summarized in the decisions below so this
project's integration doesn't repeat the same debugging cycle.

## Decisions

### 1. Adopt `@sentry/astro` for error monitoring

It's Sentry's maintained Astro integration, wraps SSR routes and API
endpoints automatically, and matches this project's stack
(`output: 'server'`, `@astrojs/vercel` adapter — `astro.config.mjs`).

### 2. Explicitly `await Sentry.flush()` before every early return that follows a manual capture call

`@sentry/astro`'s middleware normally flushes automatically in a
`finally` block, which on Vercel resolves to a background task
(`vercelWaitUntil`). That's reliable for requests that run long enough
for the platform to schedule the background task, but a request that
fails fast (e.g. a 401 from an upstream LLM provider, returned in well
under a second) can have its execution context frozen before the
flush task is ever scheduled — the event is captured, then silently
dropped, with no exception or log anywhere. This bit the prior project
specifically on its provider-failover error paths (`workout-generation`
here has the same shape — Groq → OpenRouter → deterministic fallback,
`fallback-chain-planner.ts`).

Fix: any manual `Sentry.captureException` / `Sentry.captureMessage`
call site must `await Sentry.flush(5000)` on the same execution path,
immediately before the handler returns — not rely on the automatic
serverless flush.

### 3. Fire-and-forget side effects use `waitUntil` from `@vercel/functions`, not a bare unawaited promise

Any endpoint that deliberately doesn't block its response on a side
effect (e.g. a best-effort write) must wrap that side effect —
including its own error capture — in Vercel's `waitUntil`, which is a
tracked background task the platform actually waits on. A bare
`doWrite().catch(reportError)` with no `await` and no `waitUntil` has
nothing holding the function open for either the write or the error
report to complete, and is the same silent-drop failure as decision 2
in a different shape.

### 4. Use Sentry's Stats/Usage page as ground truth when verifying delivery, not the Issues tab

The Issues search defaults to `is:unresolved` and can be scoped to one
environment — an event that's auto-resolved, ignored, merged, or tagged
to a different environment won't appear there, with no indication it's
being filtered rather than absent. Sentry → Stats reports raw
accepted/dropped event counts at the ingest layer; `0/0` is the only
way to conclusively confirm nothing left the app's infrastructure.

### 5. Verify with `debug: true` on `Sentry.init`, and don't trust the absence of debug lines as proof

Temporarily setting `debug: true` prints init status, capture calls,
and flush attempts into the Vercel function log — this is what surfaces
a flush that started but never finished. Remove it once confirmed
working; it's chatty. Vercel's log viewer itself can drop or truncate
output under load, so treat a missing debug line as inconclusive and
confirm against Stats (decision 4) instead.

### 6. `PUBLIC_SENTRY_DSN` unset is the intended fail-open state for local dev

The SDK no-ops entirely with no DSN configured, which is fine for local
dev (no Sentry account activity needed to develop). Only the deployed
Vercel environment needs `PUBLIC_SENTRY_DSN` set as an env var. Marking
it "Sensitive" in the Vercel dashboard only affects who can read it back
from the dashboard/CLI after saving — it has no effect on runtime
delivery and doesn't substitute for confirming the value is actually
current (a DSN is not itself a secret, so it's safe to diff against
Sentry's **Settings → Projects → Client Keys** page directly if delivery
seems broken).

## Consequences

- Every current and future manual capture call site (planner fallback
  exhaustion, Supabase errors, any endpoint using fire-and-forget
  writes) needs the explicit `flush`/`waitUntil` pattern from decisions
  2–3, not just the automatic middleware flush — this is a convention
  to enforce in review, not a one-time setup step.
- `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` (build-time,
  for release creation and source-map upload) are a separate concern
  from the runtime `PUBLIC_SENTRY_DSN` — a working release pipeline
  proves nothing about whether runtime events are actually being
  delivered.
- Implementation (installing `@sentry/astro`, wiring `astro.config.mjs`,
  adding the flush/waitUntil calls, setting Vercel env vars) is tracked
  as separate follow-up work, not part of this ADR.

## Alternatives considered

- **No error monitoring, rely on manually reading Vercel logs** —
  rejected: already the status quo, and already missed the two
  production bugs fixed this session until they were reported
  separately; doesn't scale to "know about failures without being at
  the computer."
- **A different provider (e.g. Rollbar, Bugsnag, Vercel's own
  Observability)** — not evaluated in depth; Sentry was chosen because
  the prior project already has a working (if hard-won) integration
  pattern to reuse, and `@sentry/astro` is a maintained first-party
  Astro integration.
