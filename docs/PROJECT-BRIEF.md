# Personal-TrAIner — Project Brief

> **Status:** Design phase. This document is the source of truth for *what* we are
> building and *why*. It is the context document for AI agents working on this repo.
>
> **Related documents (to be created):**
> - `AGENTS.md` — short, imperative operating rules for the coding agent
> - `docs/adr/` — architecture decision records
> - `docs/features/*.md` — BDD specs, written before implementation

---

## 1. Thesis

Most fitness apps hand you a rigid plan and expect you to adapt to it. This project
inverts that: **the plan adapts to you, every single day.**

The idea comes from a real problem. A knee injury made every existing app useless —
they had no concept of "this hurts today, work around it". Personal-TrAIner treats
daily readiness as a first-class input, not an afterthought.

The academic grounding is **autoregulated training** and the **RPE/RIR** scales
(Rate of Perceived Exertion / Reps In Reserve), both well established in sports
science literature.

### The two-level guardrail narrative

This is the unifying idea of the project and should be stated in the README:

- **Product level:** we constrain an LLM so it cannot prescribe unsafe training.
- **Process level:** we constrain a coding agent so it cannot write bad code.

The same problem — *trusting a non-deterministic system without letting it wreck
things* — solved twice, at two different layers. The quality gates, dependency
rules and `AGENTS.md` are not hygiene; they are the thesis applied to the project
itself.

---

## 2. Scope

### In the MVP

1. **Onboarding / profile** — goal, experience level, default equipment context,
   and active limitations (injuries).
2. **Daily check-in** — energy, pain (zone + level), available minutes, and
   today's equipment context. Four taps, zero typing.
3. **AI workout generation** — conditioned on profile, check-in and training history.
4. **Gym logging** — big buttons, RPE per set, autosave, rest timer.
5. **Progress tracking** — adherence, volume per movement pattern, bodyweight.

### Explicitly deferred (documented as deliberate scope decisions)

| Deferred | Reason |
|---|---|
| Nutrition tracking | Entire domain of its own (food DB, macros). MVP shows goal-aware advice text + "coming soon". |
| Voice (Whisper) / audio (ElevenLabs) | Nice, expensive in time, zero architectural value. |
| Chatbot interface | **Contradicts the thesis.** Users don't want to type. AI works *behind* a button-based UI — that is the harder and more interesting claim. |
| Push notifications | PWA push on iOS is fiddly. Ship "installable + offline-capable" instead. |
| Cardio as main training, marathon prep | Periodization is a domain comparable in size to strength. Roadmap headline. |
| VO2max and advanced metrics | Roadmap. |

### Cardio: the limited role it *does* play in the MVP

Cardio entries exist in the catalog but only in two roles:

1. **Warm-up** — 5–10 min bike/row/treadmill.
2. **Active recovery** — when readiness is depleted or pain blocks training, the app
   proposes a light walk or easy bike instead of an empty screen.

Prescribed and logged as **duration + RPE only**. No distance, no pace, no GPS, no
separate progression rules. This closes the worst hole in the readiness policy: the
app never leaves the user with nothing to do. A good coach lowers the intensity;
they don't send you home.

---

## 3. Tech stack and rationale

| Choice | Rationale |
|---|---|
| **Astro** (SSR, Vercel adapter) | Islands architecture, Core Web Vitals story, server endpoints for the AI proxy. |
| **Svelte** for interactive islands | Compiles away (no framework runtime in bundle); explicit reactivity via runes keeps components thin, which enforces "no business logic in components"; lower cognitive complexity for the Sonar thresholds. Trade-off accepted: smaller ecosystem, and most tutorials online are Svelte 4, not runes — use official docs. |
| **TypeScript strict**, `verbatimModuleSyntax` | Non-negotiable. |
| **CSS, no framework** | As per original notes. No Tailwind. |
| **pnpm** | Speed and strict dependency resolution. |
| **Supabase** | Chosen for **Auth + RLS**, not just Postgres. RLS is the strongest OWASP argument available and is nearly free. EU region. |
| **Groq** (primary) → **OpenRouter** (secondary) | Groq has proven more reliable on the free tier in prior experience. Both sit behind the same port, so switching is an env var. |
| **Zod** | Runtime validation of every LLM output and every request body. |
| **Vitest + Testing Library + Playwright** | Unit / component / E2E. |
| **ESLint + Sonar** | `cognitive-complexity < 15`, `no-nested-conditional`, `no-identical-functions`, `no-duplicate-string < 3` (disable the last one in test folders from day one, or it will torture you). |

**Rejected:** Turso (no need for edge SQLite); React (Svelte wins on bundle and on
architectural discipline); Netlify (Vercel's Astro adapter is smoother).

---

## 4. Architecture

Screaming architecture + a *simple* clean architecture. No over-engineering.

```
src/
  features/
    workout-generation/
      domain/          # entities, rules, ports. ZERO external imports
      application/     # use cases: GenerateTodayWorkout
      infrastructure/  # GroqPlannerAdapter, SupabaseWorkoutRepository
      ui/              # Svelte components. ZERO business logic
      README.md        # what this feature is and why
    daily-checkin/
    workout-logging/
    progress-tracking/
  shared/
    utils/             # pure functions, 100% coverage
    ui/                # Skeleton, Toast, Button, RpeBar
```

### Dependency rule

All dependencies point inwards.

- `domain` imports nothing.
- `application` imports only `domain`.
- `ui` and `infrastructure` are sibling details in the outer ring. Neither
  imports the other.

UI and infrastructure are both "outer ring" in classic Clean Architecture terms.
They are split into separate folders because they are opposite kinds of detail:
UI is the way *in* (the user triggers actions), infrastructure is the way *out*
(the system asks the world for things).

Only the composition root (the Astro endpoint / middleware) knows the concrete
adapters: it instantiates `GenerateTodayWorkout` with `FallbackChainPlanner` and
`SupabaseWorkoutRepository`.

Astro-specific note: for client-side Svelte components, `ui → application` is not
an import — it is a `fetch` to an API endpoint, which then calls the use case
server-side. This is what keeps the Groq key out of the browser bundle: if a
component could import the adapter, the key would end up in the bundle.

### Architecture must be *executable*, not documented

This is the single highest-value differentiator and it directly serves priority #1.

- **`eslint-plugin-boundaries`** (or `import/no-restricted-paths`) enforces the
  layer rules. Violating them fails the lint, which runs in the Husky pre-commit hook.
- **`dependency-cruiser`** validates the same rules *and* generates an SVG
  dependency graph from the real code. That autogenerated graph is the architecture
  diagram in the README — not a drawing that can lie.

Note: four features × four layers is a lot of folders, and some `application` layers
will be eight-line files. That is fine — consistency is the point — but do not
create empty folders out of dogma.

---

## 5. Domain model

| Entity | Role |
|---|---|
| `UserProfile` | goal, level, default equipment context, `Limitation[]` |
| `Limitation` | body zone + severity + active/resolved |
| `DailyCheckIn` | energy, pain (zone + level), available minutes, equipment context |
| `Readiness` | value object derived from the check-in |
| `WorkoutPlan` | prescribed session: blocks → exercises → target sets |
| `SetLog` | what actually happened: load, reps, **RPE** |
| `ProgressSnapshot` | aggregated volume, adherence, bodyweight |

### Guardrails live in the domain, not in the prompt

`TrainingDecision` is a 4-variant outcome — `NORMAL | DELOAD | ACTIVE_RECOVERY
| CHOICE` — decided from energy, pain and available time *before* any LLM
call. Full decision table, rationale and the pain/limitation merge rule are
in `docs/adr/0001-readiness-policy.md`; behavior spec in
`docs/features/readiness-policy.md`.

```ts
// application/generate-today-workout.ts
const decision = decideTrainingMode(checkIn);
if (decision.kind === 'ACTIVE_RECOVERY') {
  return WorkoutPlan.activeRecovery(decision.reason);  // the LLM is never called
}
if (decision.kind === 'CHOICE') {
  return WorkoutPlan.awaitingChoice(decision.options);  // surfaced to the UI
}
const plan = await this.planner.generate({ profile, checkIn, decision, history });
return this.validator.parseOrFallback(plan);
```

Three wins at once: the guardrail is testable with no network and no AI; it is
deterministic and demonstrable; and it proves the claim that **the LLM is
replaceable infrastructure, not the core**.

Named business constants (thresholds, caps), no magic numbers, explained in
the feature README — same pattern as the catalog's contraindication policy.

---

## 6. Exercise catalog

The keystone. Both the LLM and the deterministic generator need a closed vocabulary
of exercises; otherwise the model invents names that cannot be validated or filtered.

### Decision: a JSON file versioned in the repo, not a DB table

- It is **reference data**, not user data. In the DB it would be outside version
  control, unreviewable in PRs and untestable.
- The **deterministic generator must work with no network**. A DB-backed catalog
  would make the final fallback depend on a remote query.
- Tests import it directly — no mocks, no duplicated fixtures.
- It can be **Zod-validated in CI**.

Cost: catalog changes need a deploy. Irrelevant for an MVP, and migrating to a DB
later touches nothing, because there is an `ExerciseCatalog` port behind it. Write
an ADR.

### Decision: size is dictated by a coverage rule, not a number

> For every movement pattern there must be at least one exercise available at each
> equipment tier: **no equipment**, **basic** (dumbbells/bands) and **full gym**.

All three tiers are first-class — the same user trains at the gym on Monday, at home
on Thursday and in a hotel room on Sunday. That rule yields roughly 45 strength
exercises, plus ~10 mobility and ~6 cardio. **The rule becomes a catalog integrity
test.**

### Consequence: equipment context belongs to the check-in, not the profile

If equipment were fixed at onboarding, the app would be wrong half the days. It
becomes a fourth tap in the daily check-in (gym / home / bodyweight), with the
profile storing the *default* that comes preselected. Bonus: it produces an
excellent demo moment — same user, same day, change the context, get a completely
different session for the same movement pattern.

### Decision: stretches live in the same catalog

"Stretches based on what you trained" is not a separate feature. It is
`kind: 'mobility'` and `role: 'cooldown'`. Same schema, same pattern-based
filtering. An entire feature solved with two enums.

### Schema

```ts
// domain/exercise/exercise.schema.ts
export const BodyZone = z.enum([
  'knee', 'hip', 'lower-back', 'shoulder', 'elbow', 'wrist', 'ankle', 'neck',
]);

export const StressLevel = z.enum(['none', 'low', 'moderate', 'high']);

export const MovementPattern = z.enum([
  'knee-dominant',        // squat, leg press
  'hip-dominant',         // deadlift, hip thrust
  'unilateral-leg',       // lunges, Bulgarian split squat
  'horizontal-push',      // bench press, push-ups
  'vertical-push',        // overhead press
  'horizontal-pull',      // row
  'vertical-pull',        // pull-ups, lat pulldown
  'core-antiextension',   // plank
  'core-antirotation',    // Pallof press
  'locomotion',           // run, row, bike
]);

export const Equipment = z.enum([
  'none', 'dumbbells', 'barbell', 'kettlebell', 'band',
  'machine', 'cable', 'bench', 'pull-up-bar', 'mat',
]);

export const ExerciseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(3),
  kind: z.enum(['strength', 'mobility', 'cardio']),
  pattern: MovementPattern,
  roles: z.array(z.enum(['warmup', 'main', 'accessory', 'cooldown'])).min(1),

  primaryMuscles: z.array(MuscleGroup).min(1),
  secondaryMuscles: z.array(MuscleGroup).default([]),
  equipment: z.array(Equipment).min(1),
  level: z.enum(['beginner', 'intermediate', 'advanced']),

  // The field the entire thesis rests on:
  jointStress: z.partialRecord(BodyZone, StressLevel).default({}),
  impact: StressLevel,          // landings, plyometrics, running
  unilateral: z.boolean(),

  progression: z.enum(['load', 'reps', 'time']),
  defaultRepRange: z.object({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
  }),
  defaultRestSeconds: z.number().int().positive(),

  cues: z.array(z.string()).max(3),   // 2–3 technique cues for the UI
});
```

Example entry:

```json
{
  "id": "bulgarian-split-squat-dumbbell",
  "name": "Bulgarian split squat with dumbbells",
  "kind": "strength",
  "pattern": "unilateral-leg",
  "roles": ["main", "accessory"],
  "primaryMuscles": ["quadriceps", "glutes"],
  "secondaryMuscles": ["hamstrings", "core"],
  "equipment": ["dumbbells", "bench"],
  "level": "intermediate",
  "jointStress": { "knee": "high", "hip": "moderate", "ankle": "low" },
  "impact": "none",
  "unilateral": true,
  "progression": "load",
  "defaultRepRange": { "min": 8, "max": 12 },
  "defaultRestSeconds": 90,
  "cues": ["Torso slightly forward", "Knee tracks over the foot"]
}
```

### Injury filtering — the structural guardrail

```ts
// domain/exercise/contraindication-policy.ts
const MAX_ALLOWED_STRESS: Record<LimitationSeverity, StressLevel> = {
  mild:     'moderate',
  moderate: 'low',
  severe:   'none',
};

export function isSuitableFor(
  exercise: Exercise,
  limitations: readonly Limitation[],
): boolean {
  return limitations
    .filter(l => l.isActive)
    .every(l => stressRank(exercise.jointStress[l.zone] ?? 'none')
              <= stressRank(MAX_ALLOWED_STRESS[l.severity]));
}
```

Worked example: a *moderate* knee limitation caps allowed knee stress at `low`. The
Bulgarian split squat above (`knee: high`) is excluded, as are squats and any
jumping. Romanian deadlifts (`knee: low`) survive, and the whole upper body is
untouched. **The user keeps training, adapted.**

Critically, this happens **before the LLM is involved**: the model only ever sees
the already-safe subset of the catalog. It cannot prescribe something
contraindicated even if it wanted to. That is a structural guardrail, far stronger
than asking for it in a prompt.

### Catalog integrity tests (cheap, run in CI)

1. All IDs unique; the whole catalog validates against the schema.
2. Coverage: every pattern has a no-equipment, basic and gym option.
3. Every pattern has at least one beginner-level exercise.
4. **No dead zone:** for every body zone, filtering by a *severe* limitation still
   leaves a viable session of at least N exercises. This is the important one — it
   guarantees the app is never left with nothing to offer.
5. Cooldown/mobility exercises exist for every pattern.

---

## 7. AI layer

### Hard rule

**The provider API key never leaves the server.** Every LLM call goes through an
own endpoint (`/api/workouts/generate`) that: verifies the session → checks the
user's quota → calls the provider with the env key → validates the response with Zod.

### Degradation chain

```
Groq  →  OpenRouter  →  Deterministic rule-based generator
```

The last link depends on nothing external. The app works with no AI provider, no
quota and no money. Defending graceful degradation is a far more mature position
than "it all works because the LLM answers".

```ts
// infrastructure/planners/fallback-chain-planner.ts
export class FallbackChainPlanner implements WorkoutPlanner {
  constructor(private readonly chain: readonly WorkoutPlanner[]) {}

  async generate(request: PlanRequest): Promise<WorkoutPlan> {
    for (const planner of this.chain) {
      const result = await planner.tryGenerate(request);
      if (result.ok) return result.plan;
      this.telemetry.record(planner.name, result.error);
    }
    throw new NoPlannerAvailableError();
  }
}
```

Because every link implements the same port, **the chain is tested with no network**:
inject one planner that always fails and one that succeeds, assert the ordering.

Log which link served each request. "Groq down → OpenRouter served it → user never
noticed" is an excellent moment for the demo video.

### Provider notes

- **Groq structured output:** JSON mode guarantees syntax, not domain validity. The
  model can return perfectly formed JSON containing an exercise that is not in the
  catalog, or negative sets. Always Zod-validate on receipt.
- **Log every Zod validation failure** on an LLM response (which field, what value,
  which link in the chain) rather than only counting it as a failure. This is the
  feedback signal for catalog gaps and prompt tuning — if the model keeps proposing
  an exercise that doesn't exist, that's either a prompt problem or a missing
  catalog entry, and the log is how you'd know which.
- **Free-tier limits (429):** treat explicitly as "link failed" so the chain
  continues, rather than propagating it as an error.
- Available Groq models and their current limits change often — **confirm against
  their docs at implementation time**, do not trust anything written here.

### What the LLM sees

Not the whole catalog (thousands of wasted tokens). A compact projection of the
already-filtered subset:

```
id | name | pattern | equipment | level
```

The output schema references exercises **by ID from that list**. Validation checks
the ID exists *and* was in the permitted set. Invented ID → validation fails →
retry or next link in the chain.

---

## 8. Quality gates

Coverage thresholds in `vitest.config.ts`:

- **100%** domain and `shared/utils` (pure functions)
- **80%** application
- **0%** infrastructure (covered indirectly)
- Exclude `infrastructure`, `types`, stories

### Testing philosophy — be honest about it

Testing is the **evidence** that the architecture is good: if the domain is pure and
decoupled, it tests without mocks; if a use case needs half the world mocked, the
architecture is wrong. Present it as "verifiable architecture", one section, not two.

Nobody does pure TDD on a deadline. The defensible position: strict TDD in domain
and utils (where it is cheap and valuable), tests-after in UI, E2E on critical flows
only. Saying that with judgement scores better than faking purity.

### Other gates

- **Husky:** pre-commit → lint + typecheck + secret scan; pre-push → unit + E2E
- **GitHub Actions:** lint → typecheck → unit + thresholds → dependency-cruiser →
  build → E2E. Badges in the README.
- **rollup-plugin-visualizer** for bundle analysis (also produces the Svelte
  bundle-size numbers used to justify the framework choice).
- **a11y AA minimum:** `eslint-plugin-jsx-a11y` equivalent + axe checks in
  Playwright. `aria-live` for the rest timer and toasts. Cross-check the checklist
  at [A11Y.md](https://github.com/fecarrico/A11Y.md) at implementation time — decide
  then how much of it is worth adopting; if only partially adopted, it's still worth
  an ADR line on what was taken and what wasn't, and why.
- **Sentry** + Core Web Vitals (port config from the Agnotopía repo).

### E2E

Three flows, no more. Page Objects. `getByRole` wherever possible. `data-testid`
only as a last resort — one accepted exception without negotiation: dynamic list
items where the role does not disambiguate.

1. Onboarding → check-in → generate workout
2. Log a full session
3. View progress

---

## 9. Deployment, access control and cost

Deployed on **Vercel**. Repo is **public**.

| Concern | Solution |
|---|---|
| Who can log in | Supabase Auth with **public signup disabled**. Accounts created manually. Invite codes later if opening up. |
| Provider cost | Per-user daily quota (`DAILY_GENERATION_LIMIT`, a domain constant), persisted in the DB, checked *before* calling the provider. |
| Quota exhausted | Falls through to the deterministic generator. The user still gets a workout, the bill does not move. **One decision, three problems solved** — write the ADR that way. |
| Hard ceiling | A dedicated provider API key with a small credit cap, plus spend alerts. |
| Bot protection | Rate limiting on the login endpoint (Astro middleware); Vercel Attack Challenge Mode available if needed. |
| Headers | CSP, HSTS, X-Frame-Options in middleware — cheap, and a solid OWASP paragraph. |
| Secrets | Keys in Vercel env only. `.env.example` with empty commented keys. Secret scanning in pre-commit. |

**Public repo caveat:** the generation endpoint is visible, so there is zero room for
security-by-obscurity. Auth verified server-side, quota checked before the provider
call, and Zod validation on the *request* body too, not just on the LLM response.

### Seed data — do not skip this

A fresh account starts as an **empty app**: no history, no charts, nothing that
shows the value. Half the application becomes invisible until it has data.

Ship a **seed script** that populates the account with 3–4 weeks of realistic
history: logged sessions, varied RPE, bodyweight trend, and at least one day where
pain forced active recovery. Version the script in the repo — it is evidence of good
work in itself. Also provide a "reset my demo data" path.

---

## 10. Deliverables and process artifacts

Conventional Commits, atomic, telling the story of the build. README with
problem and thesis in three lines, screenshots/GIF, quickstart, the
autogenerated dependency graph, CI badges. `AGENTS.md` — short, imperative
operating rules for the coding agent, including an **"observed
anti-patterns"** section grown from real corrections. `docs/adr/` for
decision records. `docs/features/*.md` — BDD specs written *before*
implementing, doubling as the best possible prompt for the agent. A
`docs/ai-workflow.md` documenting how the agent was used and what went wrong.

> Course-specific evaluation requirements (instructor access, submission
> checklist, video) live in `docs/COURSE-SUBMISSION.md`, kept separate so
> this document reads the same whether the audience is a teammate, a future
> contributor, or an instructor.

---

## 11. Compliance — correct dosage

Do not overinvest, but do not drop it either: it shows product judgement and
the project has a future.

- **In the app:** a visible medical disclaimer. The pain guardrail already exists as
  domain logic anyway.
- **In the repo:** one short ADR on health-data handling — training data, bodyweight
  and injuries are **special-category data under GDPR Art. 9**; explicit consent as
  legal basis, data minimisation, EU region on Supabase. Half a page.
- **In the roadmap:** full GDPR (export, deletion, granular consent) as v2.

Not one paragraph more.

---

## 12. Still to be designed

Recommended order: the first four give a **fully working app with no AI at all**,
after which the LLM plugs in as an enhancement on top of something that already
works — which is precisely the thesis.

1. ~~Exercise catalog~~ — **designed** (schema, filtering policy, integrity tests).
   Remaining: generate the ~60 actual entries.
2. ~~Readiness policy~~ — **designed** (energy/pain/time decision table, pain ×
   limitation merge rule, `CHOICE` outcome). See
   `docs/adr/0001-readiness-policy.md` and `docs/features/readiness-policy.md`.
3. ~~`WorkoutPlan` Zod schema~~ — **designed** (discriminated `SetTarget` per
   progression kind, per-set arrays, reject-whole-plan on business violation). See
   `docs/adr/0002-workout-plan-schema.md` and `docs/features/workout-plan-schema.md`.
4. ~~Deterministic generator~~ — **designed** (full-body split for MVP, LRU rotation,
   goal-based rep ranges, DELOAD via RPE cap + set reduction). See
   `docs/adr/0003-deterministic-generator.md` and
   `docs/features/deterministic-generator.md`.
5. ~~Progression and autoregulation rules~~ — **designed** (RPE-vs-target load
   adjustment, stall detection as a per-exercise backoff distinct from
   readiness-DELOAD, conservative reintroduction after a resolved limitation). See
   `docs/adr/0004-progression-autoregulation.md` and
   `docs/features/progression-autoregulation.md`. *This is the heart of the thesis.*
6. **`WorkoutPlanner` port contract** — especially the **history summarisation**
   (volume per pattern, days since each group was trained, recent mean RPE). A domain
   transformation with its own tests. Never send raw set logs.
7. **Prompt construction** — system prompt, context serialisation, prompt versioning
   tied to the schema version. Test the prompt *assembly*, not the response.
8. **Data model and RLS policies** — including the daily quota table.
9. **UI flows** — the 4-tap check-in and the gym logger (big buttons, RPE bar, rest
   timer). Reusable `Skeleton` for loading, `Toast` for notifications.
10. **Endpoint contracts** — routes, request/response shapes, error codes, session
    and quota middleware.
11. **Test strategy per layer.**
12. **Build plan** — weekly ordering and what gets delegated to the agent in each phase.

---

## 13. Roadmap (post-MVP)

Nutrition tracking · voice interaction (Whisper) and audio workout export
(ElevenLabs) · push notifications · cardio as primary training · **marathon
preparation with full periodization** · VO2max and advanced metrics · full GDPR
tooling · catalog migration to DB with user-contributed exercises.

Marathon prep is the headline for "where this project is going" — it is more useful
in the roadmap than in the MVP.

Also on the roadmap, lower priority but cheap to note now:

- **Internationalisation** — at least Spanish. MVP ships English-only; the catalog's
  `name`/`cues` strings and UI copy would need an i18n layer, not a rewrite, if the
  string keys are kept clean from the start.
- **Exercise media** — short demo video/GIF or link per catalog entry, plus longer
  technique explanations beyond the 2–3 UI cues. Deferred because it turns the
  catalog from "reference data" into "reference data + asset pipeline," a bigger
  commitment than the MVP needs.
- **LLM output caching at the domain level** — if generated plans for very similar
  inputs (same profile, same decision, similar recent history) turn out to be
  near-identical, cache/reuse rather than re-prompting. Explicitly not for the MVP:
  it's an optimization that needs real usage data to know if it's even true, and
  premature caching risks staleness bugs for a saving that may not matter yet.

Note: **progression** (how logged RPE drives load/rep changes over time) is *not* a
roadmap item — it's core to the MVP thesis and already tracked as design item 5 in
§12 ("Progression and autoregulation rules... the heart of the thesis").
