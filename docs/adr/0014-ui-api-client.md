# ADR 0014 — UI API client: one typed function per endpoint, no raw fetch in components

## Status

Accepted

## Context

The UI phase (ADR 0008, ADR 0013 phase 5) built six components that each
called `authorizedFetch` directly, duplicating `response.ok` checks,
`response.json()` parsing, and error-message strings inline. This was
flagged post-merge as an anti-pattern: components mixed two concerns
(what to call over HTTP, and how to render the result), the same endpoint
was called with a slightly different shape in more than one place (e.g.
`/api/workouts/generate`'s response was destructured ad hoc in both
`CheckInFlow` and `HomeView`), and there was no single place to see the
full list of endpoints the UI depends on.

## Decision

### 1. `src/features/workout-generation/ui/api-client.ts` is the only caller of `authorizedFetch`

One function per endpoint (`submitCheckIn`, `resolveChoice`,
`generateWorkout`, `getWorkout`, `logSet`, `skipExercise`, `endSession`,
`getProgress`, `getProfile`, `saveProfile`, `addLimitation`,
`resolveLimitation`, `getTodayStatus`), each typed against the domain
schemas already used elsewhere (`WorkoutPlan`, `TrainingDecision`,
`ProgressSnapshot`, etc.) rather than `unknown`/`any`. Components import
these functions instead of `authorizedFetch`.

### 2. Same `Result`-typed no-throw convention as the repository/planner layers

```ts
export type ApiResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly status: number };
```

This mirrors `RepositoryResult`/`WorkoutPlanner`'s existing convention
(ADR-0005 decision 1) — a failed HTTP call is a routine, expected outcome
for the UI to branch on, not an exception to catch. Keeping `status` on
the failure branch (rather than just `ok: false`) matters in practice:
`HomeView` needs to distinguish a 404 ("no check-in yet, redirect to
`/checkin`") from any other failure ("show an error").

### 3. `LoginForm` is exempt — it calls the Supabase auth SDK, not this backend

`LoginForm.svelte` calls `getSupabaseBrowserClient().auth.signInWithPassword`
directly. That's a different concern (authentication against Supabase
Auth, not a call to one of this app's own `/api/*` routes) and doesn't
belong in an API client whose job is documenting *this backend's*
endpoint surface.

## Consequences

- Any new UI component that needs backend data adds a function to
  `api-client.ts` first, then calls it — never `authorizedFetch` directly.
  `eslint-plugin-boundaries` doesn't enforce this (both are `ui`-layer
  files, so nothing currently blocks a component from importing
  `authorizedFetch` again); it's a convention, not a lint rule.
- `api-client.ts` is a single, readable list of every endpoint the UI
  depends on — useful when changing an endpoint's contract, since every
  caller is visible in one file instead of grep'd across components.
- Component tests didn't need to change their mocking strategy: they
  already mocked the `authorized-fetch` module, and `api-client.ts` calls
  through that same module, so the mock still intercepts every call
  transitively.

## Alternatives considered

- **A lint rule banning `authorizedFetch` imports outside `api-client.ts`**
  — considered, not added: `eslint-plugin-boundaries` restricts by layer
  (`ui`/`domain`/`shared`/etc.), not by specific file-to-file import path,
  and adding a one-off rule for a single file felt like more machinery
  than a 6-component codebase warrants. Revisit if the anti-pattern
  recurs.
- **Leaving `authorizedFetch` calls in components** — rejected: the
  duplication was real (multiple ad hoc destructurings of the same
  endpoint's response shape) and the anti-pattern was explicitly called
  out for cleanup.
