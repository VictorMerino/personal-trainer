# ADR 0017 — Public repo and Vercel deploy identity

## Status

Accepted

## Context

The repo needed to go public — required for the course submission, and
to avoid Vercel's Hobby-plan restrictions on private-repo collaboration.
Right after going public, deploys started failing with `Git author
...@users.noreply.github.com must have access to the team
victormerino's projects on Vercel`, even though the same commit author
had deployed successfully before. It was tempting to assume the
visibility change caused this, but it turned out to be unrelated —
worth recording so the connection isn't assumed next time.

## Decisions

### 1. Repo is public

Required by the course and avoids Vercel Hobby-plan collaboration limits.
Confirmed no secrets or personal data exist anywhere in commit history
before flipping visibility (checked via full-history grep for key
patterns, real emails, and phone numbers — none found; only test
fixtures like `password123!` and `user@example.com`).

### 2. Vercel needs its GitHub App installed, and the deploying identity must be linked

Deploys run via CLI (`vercel --prod`, ADR-0016 decision 4), not Vercel's
native Git integration — but Vercel still verifies the pushed commit's
author against GitHub, and that verification requires Vercel's GitHub
App to be installed on the account (github.com/apps/vercel) with access
to the repo. Once installed, a second requirement showed up: the Vercel
account's own login must be connected to the same GitHub identity as the
commit author (Vercel dashboard → Settings → Login Connections),
otherwise Vercel treats the commit author as an outside collaborator,
which Hobby-tier teams reject. Both were one-time account setup, not
anything to redo per deploy, and neither depended on the repo being
public — a private repo would have hit the same two requirements.

## Consequences

- If deploys ever start failing again with a similar "git author" error
  (e.g. after transferring the Vercel team, or using a different GitHub
  account), check the GitHub App installation and Vercel login
  connection first, in that order — not repo visibility.

## Alternatives considered

- None — both the visibility change and the deploy-identity fixes were
  required, not optional choices among alternatives.
