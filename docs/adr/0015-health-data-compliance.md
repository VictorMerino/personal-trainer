# ADR 0015 — Health-data compliance: consent, minimisation, region

## Status

Accepted

## Context

`docs/PROJECT-BRIEF.md` §11 asks for "correct dosage" on compliance: not
overinvesting, but not skipping it either, since training and injury data
are **special-category data under GDPR Art. 9** (health data). This ADR is
that half-page, not a general GDPR implementation.

## Decisions

### 1. Explicit consent is the legal basis, and it's a real database record, not just UI copy

`user_profiles.data_consent_at` (migration `20260808090000`) is set to
`now()` server-side on every successful `PUT /api/profile`
(`upsert_profile`/`SupabaseProfileRepository.upsertProfile`), re-affirmed
on each save rather than only the first. `PUT /api/profile` rejects the
request (400) if the body's `consent` field isn't `true` — the client
can't save a profile without it. `OnboardingForm` shows the required
disclaimer and consent checkbox directly above the save button: *"This app
is not a medical service and does not provide medical advice... I consent
to my training and injury data being processed..."* This satisfies both
of §11's app-facing requirements (visible disclaimer, explicit consent) in
one control, since the checkbox's label *is* the disclaimer.

### 2. Data minimisation: bodyweight stays out of scope until it ships with nutrition

Already decided in `docs/adr/0010-progress-tracking.md` decision 2 — no
bodyweight field exists anywhere yet. Restated here because it's also the
minimisation answer: don't collect data with no current use. The pain
guardrail (`docs/adr/0001-readiness-policy.md`) is the one piece of health
data genuinely necessary to the product and already exists as domain
logic — nothing new to build for minimisation, only to not add more later
without a use.

### 3. EU region on Supabase is a deployment requirement, not yet a confirmed fact

Unlike decisions 1–2, this isn't implemented by application code — it's
infrastructure configuration on the Supabase project itself, and as of
this ADR it has **not been confirmed** to be set to an EU region. This is
the one open compliance action: verify/set the project's region before
the app is used with real user data. Flagged here explicitly rather than
assumed, since claiming it without checking would be worse than not
claiming it.

## Consequences

- `docs/PROJECT-BRIEF.md` §13 roadmap gains an explicit "full GDPR (export,
  deletion, granular consent) — v2" line, not attempted here.
- Bodyweight's minimisation treatment (decision 2) is inherited by
  nutrition once that ships post-MVP, per ADR-0010 — no new decision
  needed then, just the same reasoning applied.
- Decision 3's open item should be closed (Supabase project region
  verified/set to EU) before treating this ADR as fully satisfied.

## Alternatives considered

- **A separate `consents` table / granular per-purpose consent** —
  rejected as overinvestment for MVP scope; one timestamp on the existing
  profile table is proportionate to what §11 asks for. Full granular
  consent is the named v2 roadmap item.
- **Consent recorded client-side only (e.g. localStorage), no DB column**
  — rejected: not a real legal-basis record if the server never verifies
  or stores it, and doesn't survive a new device/browser.
