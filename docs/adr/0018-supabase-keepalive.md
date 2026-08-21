# ADR 0018 — Supabase keepalive workflow

## Status

Accepted

## Context

The deployed site started throwing `net::ERR_NAME_NOT_RESOLVED` on
Supabase requests after roughly a week of no traffic. The hosted
Supabase project (ADR-0016 decision 1) had auto-paused, which is a
free-tier behavior triggered by inactivity — not by anything in this
repo changing, and not something incoming requests to the paused project
undo on their own; it needed a manual "Restore project" from the
Supabase dashboard.

## Decisions

### A daily GitHub Action pings the hosted Supabase project to prevent auto-pause

Free-tier Supabase projects auto-pause after about a week of API
inactivity, and do not wake on incoming requests — pausing must be
undone manually from the Supabase dashboard, which takes a couple of
minutes and would otherwise recur roughly weekly for a project without
regular real traffic. `.github/workflows/supabase-keepalive.yml` runs
daily (`workflow_dispatch` also available for manual runs) and hits `GET
$SUPABASE_URL/auth/v1/health` with the anon/publishable key in the
`apikey` header, which is enough API activity to reset the inactivity
timer without touching any table. `SUPABASE_URL` and `SUPABASE_ANON_KEY`
are GitHub Actions secrets, not hardcoded — the project ref itself isn't
sensitive (it's already public in every browser request the deployed
site makes), but keeping it out of the workflow file avoids needing to
edit the file if the project is ever recreated.

Originally targeted `GET $SUPABASE_URL/rest/v1/` (PostgREST's root/
schema-introspection path). That broke in 2026-08 when Supabase's new
API key system (JWT-style anon keys → opaque `sb_publishable_...` keys)
shipped alongside a gateway change restricting that root path to the
`service_role` key only — an anon/publishable key now gets a 401
(`Only the service_role API key can be used for this endpoint`)
regardless of correctness. Switched to GoTrue's `/auth/v1/health`
endpoint instead, which only needs the `apikey` header (no
`Authorization` — passing the new opaque key as a `Bearer` token also
401s, since it isn't a JWT) and returns 200 with a version/name payload
for any valid key.

## Consequences

- If the Supabase project pauses despite the keepalive workflow (e.g. the
  Action itself silently fails), the fix is still the manual "Restore
  project" dashboard action — the workflow only prevents the pause, it
  doesn't help recovery.
- Upgrading to Supabase's paid tier would remove the need for this
  workflow entirely (no auto-pause), so this ADR should be revisited if
  that ever happens.

## Alternatives considered

- **Vercel Cron Job for the keepalive ping instead of GitHub Actions** —
  rejected: would require a paid Vercel plan for cron functionality,
  while GitHub Actions' free tier easily covers a once-daily request.
