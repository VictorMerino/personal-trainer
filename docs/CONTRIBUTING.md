# LLM-First Development Principles

## Premise

The bottleneck is no longer writing code.

The bottleneck is designing a coherent mental model that an LLM can consistently implement.

Code is cheap.
Architecture is expensive.

---

# 1. Do not write code until the model is clear.

Every line of code should be a consequence of previously documented decisions.

Before implementation, define:

* Why the project exists.
* Which problem it solves.
* The core principles.
* The vocabulary.
* The system boundaries.
* The mental model.

If these are unclear, writing code only creates technical debt faster.

---

# 2. Document principles, not features.

Features change.

Principles should survive multiple implementations.

Good documentation answers questions like:

* Why does this exist?
* What assumptions are we making?
* What trade-offs have we accepted?
* What would never belong in this project?

---

# 3. Build a shared language.

A project should develop its own glossary.

Important concepts must have precise definitions.

Examples:

* Discovery
* Exploration
* Architecture
* Journey
* Context
* Session
* Intent

If two people (or two LLM sessions) interpret a word differently, the architecture is already drifting.

---

# 4. Every document answers exactly one question.

Examples:

* philosophy.md → Why does this project exist?
* glossary.md → What do our concepts mean?
* architecture.md → How is the system organized?
* data-model.md → What information do we represent?
* prompting.md → How should LLMs reason?

Avoid documents that try to explain everything.

---

# 5. Documentation is the source of truth.

The implementation follows the documentation.

Never update code without understanding whether the documentation also needs updating.

The docs describe intent.

The code describes one implementation of that intent.

---

# 6. Optimize for understanding, not implementation speed.

A week spent refining the architecture is often cheaper than a day rewriting production code.

Resist the temptation to "just start coding."

---

# 7. Ask "Why?" before "How?"

Bad questions:

* How should we implement this?
* Which framework should we use?

Better questions:

* Why should this exist?
* What property are we trying to preserve?
* What problem disappears if we remove this feature?

Implementation usually becomes obvious afterwards.

---

# 8. Design systems, not screens.

UI is an expression of the underlying model.

If the model is coherent, multiple interfaces become possible.

If the model is weak, every UI becomes confusing.

---

# 9. Treat conversations as design artifacts.

Conversations are not disposable.

Interesting ideas should be extracted into documentation.

The documentation becomes the long-term memory of the project.

---

# 10. LLMs are implementation partners, not decision makers.

An LLM can:

* write code
* refactor
* generate tests
* explain alternatives
* explore designs

The human remains responsible for:

* product vision
* architectural principles
* trade-offs
* long-term consistency

---

# Rule of Thumb

Whenever implementation feels difficult, stop writing code.

The problem is usually not the implementation.

It is an unclear model.

Clarify the model first.

Then let the implementation follow.
