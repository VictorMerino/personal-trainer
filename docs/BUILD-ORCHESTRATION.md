# Build orchestration: how the agent knows what to build, and when

> This describes a general working method, applied here to Personal-TrAIner.
> Nothing below is specific to fitness apps or to this stack — it's a way of
> sequencing agent-driven development so that "what should the agent build
> next" is never a guess, by either the agent or the human reviewing it.

## The problem

Handing a coding agent a codebase and a rough goal produces plausible-looking
code in an arbitrary order: it will happily write a UI component before the
domain logic it displays exists, or an API endpoint before the data model it
reads from. Nothing catches this until someone reviews it and discovers the
dependency runs the wrong way. Reviewing after the fact is expensive and
easy to skip under time pressure — exactly when it matters most.

The fix isn't "review more carefully." It's removing the ambiguity before
the agent starts, so there's a single defensible answer to "what's next,"
derivable from the codebase's own rules rather than from the reviewer's
memory or mood that day.

## Three layers, each answering a different question

**1. A dependency rule fixes the *order*, before any code exists.**

A layered architecture (domain → application → infrastructure/UI, dependencies
pointing inward only) is a partial order on what can be built first. Domain
imports nothing, so it's buildable and testable in total isolation. Anything
in an outer ring needs an inner ring to exist first, because it imports it.
This isn't a scheduling opinion — it falls directly out of the dependency
rule itself. Given the rule, the phase order (domain → infrastructure →
application/endpoints → UI, roughly) is not a choice being made per project,
it's read off the graph.

**2. A written spec fixes the *content*, before the agent starts.**

Each unit of work is preceded by a short design record (why this shape, what
was rejected and why) and a BDD-style spec (Given/When/Then scenarios) written
*before* implementation. The spec becomes the actual prompt handed to the
agent — not an improvised description typed into a chat box in the moment.
This matters for two reasons: the agent has a concrete, checkable target
instead of an ambiguous one, and the human reviewer is checking "does this
match the spec" (fast, mechanical) rather than "what should this have done"
(slow, requires reconstructing intent from scratch).

**3. Executable boundaries fix what "wrong order" even means, automatically.**

The dependency rule from layer 1 is enforced by lint (import-boundary rules)
and a dependency-graph tool that fails the build if an inner layer imports
an outer one. This turns "the agent built something in the wrong order or
wrong layer" from a subtle code-review catch into a hard failure the agent
sees immediately, in the same feedback loop as a syntax error. The rule
stops being a document someone has to remember and starts being a gate
nothing can pass without satisfying.

## Putting it together: "what's next" is a lookup, not a decision

For any given unit of work, three questions, three fixed answers:

- **Where does it go?** — wherever the dependency rule says a thing with its
  import needs belongs. Not negotiable per-task.
- **What does it do?** — whatever its spec says, written and agreed before
  the agent opens a file.
- **Is it actually in the right place?** — whatever the lint/boundary tool
  says, checked automatically, not by memory.

The human's job narrows to: write the spec well, review the diff against
it, and merge. The agent's job is: read the spec, respect the boundary
rules the tooling would reject anyway, produce a reviewable unit of change.
Neither side is inventing the plan mid-task — the plan was fixed by the
architecture and the spec before either of them started.

## Consequence: granularity and cadence become tunable, not existential

Because the ordering is derived rather than remembered, changing pace (more
or fewer units of work per day) or granularity (splitting or merging units)
doesn't threaten correctness — the dependency rule and the boundary lint
hold regardless of how finely the work is sliced. The only thing that has to
stay fixed is *that* every unit is reviewed against its own spec before
merging; how many of those happen per day is a throughput knob, not a
correctness one.
