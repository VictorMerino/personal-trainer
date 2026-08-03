import type { PromptContext } from '../prompt/prompt-context';

// Kept close to LlmPlanContentSchema (llm-plan-content.schema.ts) so the
// instructions and the parser describing them never drift apart silently.
// Identical wording to groq-prompt.ts's SYSTEM_PROMPT — kept as a separate
// copy (not a shared import) so each provider's prompt can be tuned
// independently once real responses reveal provider-specific quirks.
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

export interface OpenRouterChatMessage {
  readonly role: 'system' | 'user';
  readonly content: string;
}

export function buildOpenRouterMessages(context: PromptContext): readonly OpenRouterChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(context) },
  ];
}
