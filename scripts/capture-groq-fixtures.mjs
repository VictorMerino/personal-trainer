#!/usr/bin/env node
// Manual fixture capture for the Groq adapter (ADR-0012 decision 2).
// Not part of the app, not run in CI. Re-run by hand when Groq's response
// shape drifts or a live smoke test fails.
//
// Usage: node --env-file=.env scripts/capture-groq-fixtures.mjs
//
// Captures two REAL responses:
//   - a normal completion -> fixtures/groq-success.json
//   - a completion truncated via a tiny max_tokens -> fixtures/groq-malformed-json.json
// fixtures/groq-rate-limited.json is intentionally left as-is: forcing a
// real 429 would mean burning free-tier quota on repeat runs, and the
// error envelope shape it uses is already the one documented by Groq.

import { writeFile } from 'node:fs/promises';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
const FIXTURES_DIR = 'src/features/workout-generation/infrastructure/planners/fixtures';

// Kept in sync by hand with groq-prompt.ts's SYSTEM_PROMPT — this script is
// a disposable capture tool, not the code under test.
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

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error('GROQ_API_KEY is not set (expected via --env-file=.env)');
  process.exit(1);
}

async function capture(label, extraBody, outFile) {
  const response = await fetch(GROQ_URL, {
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

await capture('success', {}, `${FIXTURES_DIR}/groq-success.json`);
await capture('truncated', { max_tokens: 40 }, `${FIXTURES_DIR}/groq-malformed-json.json`);
