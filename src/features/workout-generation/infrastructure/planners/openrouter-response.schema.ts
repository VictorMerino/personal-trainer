import { z } from 'zod';

// Shape confirmed against openrouter.ai/docs/api-reference at implementation
// time (2026-08-03) — OpenRouter's OpenAI-compatible chat completion
// envelope. Re-confirm before reuse: PROJECT-BRIEF §7 flags that provider
// docs/limits change often.
export const OpenRouterChatCompletionSchema = z.object({
  id: z.string(),
  choices: z
    .array(
      z.object({
        message: z.object({
          role: z.string(),
          content: z.string(),
        }),
      }),
    )
    .min(1),
});
export type OpenRouterChatCompletion = z.infer<typeof OpenRouterChatCompletionSchema>;

// OpenRouter's error envelope differs from Groq's: `code` is a number
// (mirroring the HTTP status) rather than a string `type`.
export const OpenRouterErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.number(),
    message: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
});
