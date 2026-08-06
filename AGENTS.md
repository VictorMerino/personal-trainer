## Git workflow

Per PR (one PR per feature-spec scenario group, per `docs/adr/0013-build-plan.md`):

1. Create a new branch from `main`.
2. Commit the changes on that branch.
3. Push the branch.
4. Give the user a link to open the PR — do not open the PR yourself.
5. The user creates the PR and reviews it.

Never commit directly to `main`, and never open the PR itself — that step is
always the user's.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

For anything touching Supabase-backed behavior (RLS, endpoints,
migrations), prefer a real local instance over guessing: `npx supabase
start` boots Postgres/Auth/PostgREST in Docker with migrations
auto-applied, no secrets needed (its keys are fixed local-dev demo values,
printed by `supabase start`/`supabase status -o json`). `pnpm test:rls`
and `pnpm test:e2e` both need it running first.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Observed anti-patterns

Grown from real corrections during this build (see `docs/ai-workflow.md`
for the full incidents). Read before touching the relevant area.

- **Never pass a function as a prop from an `.astro` file to a
  `client:load` island.** Astro serializes island props to JSON to ship
  them to the client — a function doesn't survive that. It silently
  becomes a non-function (no error, no warning), so the callback just
  never fires. This shipped and stayed broken for weeks (`login.astro`'s
  `onsignedin`, `onboarding.astro`'s `onsaved`) because component-level
  tests instantiate the Svelte component directly, bypassing Astro's
  serialization boundary entirely — only a real E2E test caught it. Pass
  serializable data (a route string) instead and have the component
  navigate itself.
- **When driving a `client:load` island with Playwright, wait for
  hydration before interacting.** Filling/clicking the server-rendered
  markup before Svelte's client-side mount attaches gets the value wiped
  when hydration renders over it, from that component's own initial
  state. `page.waitForLoadState('networkidle')` right after `goto` is
  enough in this app (see `e2e/helpers.ts`'s `waitForHydration`).
- **Never dump a process's raw environment** (e.g. `/proc/PID/environ`) to
  debug a running dev server, even when you're confident the values are
  non-secret local-dev keys you already know. It's a blunt instrument that
  doesn't distinguish those from real secrets sitting in the same
  environment. Use a narrower, functional check instead (hit an endpoint,
  check a response) or, if you must inspect a var, name it explicitly
  rather than dumping everything.
- **Never read `.env` or other local secret files directly**, even inside
  the project folder. Check indirectly (e.g. `[ -n "$OPENROUTER_API_KEY"
  ]`) when you need to confirm a var is set.
- **Don't trigger a real provider error just to capture a fixture.** For
  the LLM adapter fixtures, hand-write the error-shaped ones (e.g. rate
  limits) from docs/reasoning; only capture success/malformed fixtures
  from real calls. Burning quota to force a real error has no
  shape-verification benefit real users' errors won't already give you
  later.
- **A service-role/admin Supabase client bypasses RLS entirely.** A
  repository method that looks correctly scoped under the normal
  per-request client (relying on RLS alone) can leak cross-user data the
  moment it's reused with an admin client (a seed/migration script, a
  cron job). Filter by `user_id` explicitly in the query itself, don't
  rely on RLS as the only guard, for any method that might ever run under
  an elevated client.
- **Verify `git branch --show-current` before starting new work, not just
  after.** A PR was once accidentally committed on top of a different
  still-open feature branch because the check only happened afterward.
- **Never assume a branch's merge status.** Check `git log origin/main
  --oneline` before assuming a dependency PR is (or isn't) merged, rather
  than trusting memory of what was "probably" merged by now.
- **Commit messages: one short line, no multi-paragraph body.** Detail
  belongs in the PR description, which is easier to read and doesn't rot
  the way commit messages do as context around them changes.
