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

### 4. Deploys run via a GitHub Action on push to `main`, not Vercel's own GitHub integration

Every push to `main` is already a human-reviewed merge (`AGENTS.md` git
workflow, single-maintainer repo), so gating deploy on that push doesn't
add an unreviewed trigger — it deploys exactly what was just approved.
Vercel's built-in GitHub integration would achieve the same trigger, but
a repo-owned Action (`.github/workflows/deploy.yml`) is preferred: it's
versioned and reviewable like any other workflow, its logs live
alongside CI's in the GitHub Actions tab instead of Vercel's dashboard,
and it leaves room to add a separate preview-deploy job (`vercel deploy`,
not `--prod`) on pull requests later for a staging environment, without
switching deploy mechanisms. The Action authenticates with a Vercel
token stored as a GitHub Actions secret and runs `vercel --prod
--token=$VERCEL_TOKEN`; the linked project config
(`vercel link`/`.vercel/project.json`) is set up once locally as part of
the first manual deploy in this ADR, then committed so the Action reuses
it.

## Consequences

- `docs/PROJECT-BRIEF.md` §12 gains this as a closed "still to be
  designed" item once merged.
- ADR-0015 decision 3's open compliance action (EU region) is closed by
  decision 1 here, not by a separate follow-up ADR.
- The README's quickstart section should eventually note where the
  production URL lives, once the first deploy is live — tracked as a
  follow-up, not blocking this ADR.
- If a second environment (staging) is ever needed, decision 4 already
  anticipates it: add a preview-deploy job on pull requests to the same
  workflow file, reusing the linked Vercel project.

## Alternatives considered

- **Vercel's built-in GitHub integration** — rejected, see decision 4: a
  repo-owned Action gives the same trigger with reviewable config and a
  clearer path to a staging job.
- **Seeding production with demo data via the existing script** — rejected,
  see decision 2: the script has a known unfixed gap and production
  should start from a real signup, not synthetic fixtures.
- **Deferring the hosted Supabase project and deploying against local
  Supabase via a tunnel (e.g. ngrok)** — rejected: fragile, not how any
  other environment (CI, local dev) is configured, and would need
  redoing properly for the real hosted project anyway.
