# ADR 0006 — Prompt construction: independent versioning, structural exclusion of free text

## Status

Accepted

## Context

The LLM planners (Groq, OpenRouter) need a system prompt and a serialized
context built from `PlanRequest`: profile essentials, today's
`TrainingDecision`, the permitted compact exercise projection
(`docs/PROJECT-BRIEF.md` §7), and the `perPattern` view of `HistorySummary`
(`docs/adr/0005-workout-planner-port.md`) — never raw `SetLog` rows, never
the `perExercise` view. Testing philosophy is already settled in the brief:
**test the prompt assembly, this is a pure function; do not test model
responses.**

This ADR fixes how prompt versioning relates to `WorkoutPlan.schemaVersion`,
and states a security property of the current input model explicitly,
without over-claiming it as a permanent architectural guarantee.

## Decisions

### 1. Prompt version and `WorkoutPlan.schemaVersion` are tracked independently

```ts
export const PROMPT_VERSION = 1;
```

`schemaVersion` (ADR 0002) answers "what shape is this stored plan in" —
it's about `WorkoutPlanSchema` compatibility. `PROMPT_VERSION` answers "which
exact prompt wording and context format produced this plan" — useful for
debugging prompt regressions and evaluating tuning over time. These change
for different reasons: rewording an instruction for clarity is a prompt
change with no schema impact, and shouldn't force a schema bump (which would
incorrectly imply old stored data may no longer validate). A schema change,
conversely, almost always requires an accompanying prompt change (new
fields need explaining to the model) — a one-way dependency, not a reason to
merge the counters. Both are persisted on the plan (`schemaVersion` already
per ADR 0002; add `promptVersion` alongside it).

**Rule of thumb documented for future changes:** bumping `schemaVersion`
always requires checking whether `PROMPT_VERSION` also needs to bump.
Bumping `PROMPT_VERSION` does not require touching `schemaVersion`.

### 2. Context serialisation function is pure and independently testable

```ts
function buildPromptContext(
  profile: ProfileEssentials,
  decision: TrainingDecision,
  permittedExercises: readonly CompactExercise[],
  history: HistorySummary['perPattern'],
): PromptContext
```

No network, no LLM call — this only assembles the structured input. Tests
assert the *shape and content* of the assembled context (e.g. "the permitted
list contains only IDs from the filtered catalog subset," "the history
projection contains no `perExercise` data," "profile essentials excludes
fields the LLM has no use for") given fixed inputs. This is the "test the
assembly, not the response" principle already stated in the brief, made
concrete as one pure, snapshotted function.

### 3. Free-text user input is structurally excluded from the prompt for the MVP — stated as a current property, not a permanent guarantee

Every field in `PlanRequest` for the MVP originates from a button/enum
selection or a system-computed value: profile fields, check-in fields
(energy, pain zone/level, time, equipment — all taps, per the project's own
"four taps, zero typing" thesis), `TrainingDecision`, the compact exercise
list, and `HistorySummary`. None of it is free text a user typed. This means
prompt injection via user input is **structurally excluded for the MVP's
input surface**, not merely mitigated by sanitization — there's no field a
crafted string could occupy.

**This is stated as a current property of the MVP's all-button UI, not a
permanent architectural promise.** The roadmap already lists voice
interaction and the possibility of a text-based interaction mode in the
future (`docs/PROJECT-BRIEF.md` §13, and note the brief explicitly rejects a
chatbot interface for the MVP, not forever). If either is added, this
guardrail is void the moment a free-text field is introduced, and prompt
construction would need its own explicit sanitization/escaping strategy at
that point — this ADR does not attempt to design that in advance, since
designing input handling for an interaction mode that doesn't exist yet
would be speculative.

## Consequences

- `WorkoutPlan` persists both `schemaVersion` (ADR 0002) and `promptVersion`
  (this ADR) — two independent counters, checked together only when
  debugging a specific stored plan, not conflated into one.
- `buildPromptContext` is 100%-coverage domain/application-adjacent code
  (pure function, per the coverage thresholds in `docs/PROJECT-BRIEF.md`
  §8) with no network mocking required to test it.
- If/when a free-text interaction mode is added, this ADR's decision 3
  becomes void for that input path and needs a follow-up ADR — flagged here
  so it isn't missed when that roadmap item is picked up.

## Alternatives considered

- **One shared version number for prompt + schema** — rejected, see
  decision 1: forces unrelated bumps in both directions and conflates two
  different questions (data shape vs. instruction wording).
- **Testing prompt output against live LLM responses** — rejected, already
  settled in `docs/PROJECT-BRIEF.md` §8 testing philosophy; restated here
  for this feature specifically.
- **Presenting "no free text reaches the LLM" as a permanent architectural
  guarantee** — rejected, see decision 3: would misrepresent a property of
  the current UI as an immutable security control, which becomes actively
  misleading the moment the roadmap's voice/text items are built.
