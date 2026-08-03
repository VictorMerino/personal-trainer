import type { PromptContext } from '../prompt/prompt-context';

// Kept close to LlmPlanContentSchema (llm-plan-content.schema.ts) so the
// instructions and the parser describing them never drift apart silently.
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

export interface GroqChatMessage {
  readonly role: 'system' | 'user';
  readonly content: string;
}

export function buildGroqMessages(context: PromptContext): readonly GroqChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(context) },
  ];
}
