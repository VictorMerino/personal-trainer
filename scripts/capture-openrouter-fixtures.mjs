#!/usr/bin/env node
// Manual fixture capture for the OpenRouter adapter (ADR-0012 decision 2).
// Not part of the app, not run in CI. Re-run by hand when OpenRouter's
// response shape drifts or a live smoke test fails.
//
// Usage: node --env-file=.env scripts/capture-openrouter-fixtures.mjs
//
// Captures two REAL responses:
//   - a normal completion -> fixtures/openrouter-success.json
//   - a completion truncated via a tiny max_tokens -> fixtures/openrouter-null-content.json
// The default model (gpt-oss-20b:free) is a reasoning model: a tiny max_tokens
// burns its whole budget on the "reasoning" field before any JSON content is
// emitted, so `message.content` comes back `null` rather than a truncated
// JSON string. That's a genuine, likely failure mode for reasoning models, so
// the fixture is named for what it actually captures rather than forced into
// a "malformed JSON string" shape this model doesn't produce.
// fixtures/openrouter-rate-limited.json is hand-written, not captured:
// forcing a real 429 would mean burning quota on repeat runs, and the error
// envelope shape it uses is already the one documented by OpenRouter.

import { writeFile } from 'node:fs/promises';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-oss-20b:free';
const FIXTURES_DIR = 'src/features/workout-generation/infrastructure/planners/fixtures';

// Kept in sync by hand with openrouter-prompt.ts's SYSTEM_PROMPT — this
// script is a disposable capture tool, not the code under test.
const SYSTEM_PROMPT = `You are a strength & conditioning coach generating one workout for an app user.

Respond with a single JSON object, no prose and no markdown fences, matching exactly:

{
  "mode": "NORMAL" | "DELOAD",
  "blocks": [
    {
      "role": "warmup" | "main" | "accessory" | "cooldown",
      "exercises": [
        {
          "exerciseId": string,
          "sets": [
            { "kind": "load", "reps": { "min": number, "max": number }, "loadKg": number, "rpeTarget": number }
            | { "kind": "reps", "reps": { "min": number, "max": number }, "rpeTarget": number }
            | { "kind": "time", "seconds": number, "rpeTarget": number }
          ]
        }
      ]
    }
  ]
}

Rules:
- "mode" must equal the "decision.kind" given in the input (NORMAL or DELOAD). You are never asked to produce ACTIVE_RECOVERY.
- Every "exerciseId" must be one of the "id" values in "permittedExercises". Never invent an exercise or use one absent from that list.
- "rpeTarget" is 0-10. Prefer patterns in "history" with a high "daysSinceTrained" or low "volume" — they have been neglected recently.
- Respect "availableMinutes" and "equipmentContext" when choosing how many exercises/sets to include.
- Output valid JSON only.`;

const context = {
  goal: 'hypertrophy',
  availableMinutes: 45,
  equipmentContext: 'gym',
  decision: { kind: 'NORMAL' },
  permittedExercises: [
    { id: 'back-squat', name: 'Back Squat', pattern: 'knee-dominant', equipment: ['barbell'], level: 'intermediate' },
    {
      id: 'bench-press',
      name: 'Bench Press',
      pattern: 'horizontal-push',
      equipment: ['barbell', 'bench'],
      level: 'intermediate',
    },
  ],
  history: {
    'knee-dominant': { daysSinceTrained: 3, recentMeanRpe: 7, volume: 6 },
    'horizontal-push': { daysSinceTrained: 7, recentMeanRpe: 6.5, volume: 4 },
  },
};

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('OPENROUTER_API_KEY is not set (expected via --env-file=.env)');
  process.exit(1);
}

async function capture(label, extraBody, outFile) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(context) },
      ],
      response_format: { type: 'json_object' },
      ...extraBody,
    }),
  });
  const body = await response.json();
  console.log(`[${label}] HTTP ${response.status} -> ${outFile}`);
  await writeFile(outFile, `${JSON.stringify(body, null, 2)}\n`);
}

await capture('success', {}, `${FIXTURES_DIR}/openrouter-success.json`);
await capture('truncated', { max_tokens: 40 }, `${FIXTURES_DIR}/openrouter-null-content.json`);
