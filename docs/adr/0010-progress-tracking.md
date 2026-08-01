# ADR 0010 — Progress tracking: on-demand computation, adherence + volume only, bodyweight deferred

## Status

Accepted

## Context

`ProgressSnapshot` is named in the domain model (`docs/PROJECT-BRIEF.md` §5:
"aggregated volume, adherence, bodyweight") but had no design of its own —
how it's produced, what window it covers, and whether bodyweight belongs in
the MVP were all open. `docs/adr/0009-incomplete-sessions.md` already
defined what adherence means at the single-session level (logged ÷
prescribed sets, only for finalized sessions); this ADR extends that into
an aggregate view and settles the remaining questions.

## Decisions

### 1. `ProgressSnapshot` is computed on-demand, nothing new is persisted

```ts
function computeProgressSnapshot(userId: UserId, range: DateRange): ProgressSnapshot {
  // reads workout_plans + set_logs, both already permanently stored
  // returns a computed view; writes nothing new
}
```

All source data (`workout_plans`, `set_logs`) is already stored permanently
regardless of this decision — nothing about tracking history changes. What
this decision avoids is a *second*, separately-maintained copy of a
derived summary (e.g. a `progress_snapshots` table written by a periodic
job), which would need to be kept in sync with source data forever and
could silently go stale if that job broke. At MVP data volume (one user,
weeks of sessions), computing the aggregate at read time is fast enough
that there's no real performance case for accepting that sync risk.
`ProgressSnapshot` is a read-model / view-model type, not a database table.

### 2. MVP scope is adherence + volume per movement pattern — bodyweight is deferred, paired with nutrition

Bodyweight was considered and explicitly cut from MVP scope. The strongest
case for it — a secondary "is the program working" signal, useful when
weight trend can be interpreted against strength/volume trend — only
becomes actionable with an energy-balance context (are they eating enough
to build muscle, or in a deficit to lose fat) to explain *why* the number
is moving. That context is nutrition, which `docs/PROJECT-BRIEF.md` §2
already defers entirely for MVP. A bodyweight number with no nutrition
context to interpret it against is closer to noise than insight for this
specific MVP — it also doesn't map onto any of the three goal categories
(`docs/adr/0003-deterministic-generator.md` decision 3: strength /
hypertrophy / general_fitness), none of which is a weight-management goal.

**Bodyweight moves to the roadmap, explicitly bundled with nutrition** (not
standing alone) — `docs/PROJECT-BRIEF.md` §13 should list them together,
since bodyweight becomes meaningful once nutrition ships, not before.

### 3. Volume trend window is 8 weeks for the progress view, distinct from `HistorySummary`'s 14-day generation window

`HistorySummary.perPattern.volume` (`docs/adr/0005-workout-planner-port.md`)
covers a 14-day rolling window because it answers a short-horizon question
("has this pattern been neglected *lately*, for today's generation").
Progress tracking answers a different question — "is this pattern trending
up or down over meaningful training time" — which needs a longer window to
be informative; 14 days of a trend chart is too short to show anything but
noise. 8 weeks is chosen as a default long enough to show a real trend
without requiring months of history for a new user's chart to say
anything. Both windows are named constants, computed by the same
`buildHistorySummary`-adjacent pattern (a pure function over `set_logs`),
independent of each other — a future change to one does not imply a change
to the other.

### 4. Adherence aggregates the per-session definition already fixed in ADR 0009

`ProgressSnapshot.adherence` for a given range = sum of logged sets ÷ sum
of prescribed sets, across all `ended_at`-finalized `workout_plans` in that
range. In-progress (unfinalized) sessions are excluded from the
aggregate entirely, same as the single-session rule in ADR 0009 decision 4
— consistent behavior at both levels, not a new rule invented here.

## Consequences

- No new table or migration for `ProgressSnapshot` itself; only the
  already-designed `workout_plans`/`set_logs` tables are read.
- `docs/PROJECT-BRIEF.md` §13 roadmap gains an explicit bodyweight+nutrition
  pairing, replacing bodyweight's prior implicit MVP inclusion in the §5
  domain model table.
- The 8-week progress window and the 14-day `HistorySummary` window are
  two independent named constants — a future tuning of one is not assumed
  to require tuning the other.
- If on-demand computation ever becomes a real performance problem (much
  larger per-user history than the MVP anticipates), a precomputed snapshot
  can be added later without changing the read-model's shape — only how
  it's produced, which is an internal implementation detail behind the
  `computeProgressSnapshot` function boundary.
- **Addendum from `docs/adr/0011-endpoint-contracts.md` decision 4:** a
  `workout_plans` row with zero prescribed sets (a `REST`-choice day) is
  excluded from the adherence denominator entirely, not counted as 0/0.
  This refines, not redefines, decision 4's adherence formula above.

## Alternatives considered

- **Precomputed/periodic `ProgressSnapshot` storage** — rejected, see
  decision 1.
- **Including bodyweight in MVP scope** — rejected, see decision 2.
- **Reusing the 14-day `HistorySummary` window for the progress view** —
  rejected, see decision 3: too short to show a meaningful trend.
