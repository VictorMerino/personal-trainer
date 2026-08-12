# ADR 0016 — Deployment: hosted Supabase + Vercel

## Status

Accepted

## Context

`docs/PROJECT-BRIEF.md` §9 names Vercel as the deploy target and the
`@astrojs/vercel` adapter has been wired into `astro.config.mjs` since
scaffolding (`docs/adr/0013-build-plan.md` phase 1). But nothing in the
build plan ever scheduled the deploy itself as a task — it's a stated
intent with no PR behind it. This ADR is that missing task, and it
surfaced a second gap while writing it: there is no hosted Supabase
project either, only the local Docker instance every other ADR and CI job
runs against (`npx supabase start`). `docs/adr/0015-health-data-compliance.md`
decision 3 already flagged the EU-region requirement as unconfirmed
precisely because a hosted project doesn't exist yet — deploying to
Vercel without one would ship an app with no database or auth to talk to.

## Decisions

### 1. Hosted Supabase project comes before Vercel, not alongside it

The dependency only runs one direction: Vercel env vars need a real
`SUPABASE_URL`/anon key to point at, so the hosted Supabase project must
exist and have migrations applied first. Region is set to EU at creation
time — this closes ADR-0015 decision 3's open item as a side effect of
this ADR, rather than needing a separate follow-up. Migrations
(`supabase/migrations/*.sql`) are pushed with `supabase db push` against
the linked hosted project; no schema is hand-written directly in the
Supabase dashboard, keeping the migration history authoritative as it
already is for local dev.

### 2. No demo data is seeded on the hosted project

`scripts/seed-demo-data.ts` stays a local/CI-only convenience (per its
existing "known gap" note in project history — it doesn't set
`daily_checkins.decision` and hasn't been revisited since). Production
starts empty; the one real account gets created directly via Supabase's
hosted Studio UI, same as local dev's documented signup flow in the
README, not via the seed script against production data.

### 3. Production env vars are the same six from `.env.example`, minus the service-role key

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PUBLIC_SUPABASE_URL`,
`PUBLIC_SUPABASE_ANON_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` — set in
Vercel's project settings, not committed anywhere.
`SUPABASE_SERVICE_ROLE_KEY` is deliberately **not** set in Vercel: nothing
in the deployed app uses it (only the local-only seed script does, per its
own comment in `.env.example`), and per the observed anti-pattern already
documented in `AGENTS.md` ("a service-role client bypasses RLS entirely"),
the smaller the blast radius of that key's exposure, the better — it has
no reason to exist in a production serverless environment at all.

### 4. First deploy is a manual `vercel` CLI link, not GitHub-integration auto-deploy

Vercel's GitHub integration would auto-deploy every push to `main`,
which conflicts with this repo's existing rule that every merge is
already human-reviewed on GitHub (`AGENTS.md` git workflow) — adding a
second, unreviewed auto-deploy trigger on top of that doesn't add safety,
it just adds a second place deploys can happen from. Manual `vercel
--prod` after a merge keeps deployment as a deliberate, reviewable-in-the-
moment action, consistent with treating merges to `main` as the release
train rather than every push. Revisit if manual deploys become a
throughput bottleneck.

## Consequences

- `docs/PROJECT-BRIEF.md` §12 gains this as a closed "still to be
  designed" item once merged.
- ADR-0015 decision 3's open compliance action (EU region) is closed by
  decision 1 here, not by a separate follow-up ADR.
- The README's quickstart section should eventually note where the
  production URL lives, once the first deploy is live — tracked as a
  follow-up, not blocking this ADR.
- If a second environment (staging) is ever needed, decision 4's
  manual-deploy choice should be revisited — Vercel preview deployments
  per-PR are a reasonable middle ground worth reconsidering then.

## Alternatives considered

- **Vercel's GitHub auto-deploy integration** — rejected, see decision 4.
- **Seeding production with demo data via the existing script** — rejected,
  see decision 2: the script has a known unfixed gap and production
  should start from a real signup, not synthetic fixtures.
- **Deferring the hosted Supabase project and deploying against local
  Supabase via a tunnel (e.g. ngrok)** — rejected: fragile, not how any
  other environment (CI, local dev) is configured, and would need
  redoing properly for the real hosted project anyway.
