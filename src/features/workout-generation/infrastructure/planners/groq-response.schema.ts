import { z } from 'zod';

// Shape confirmed against console.groq.com/docs/api-reference at
// implementation time (2026-08-03) — Groq's OpenAI-compatible chat
// completion envelope. Re-confirm before reuse: PROJECT-BRIEF §7 flags that
// provider docs/limits change often.
export const GroqChatCompletionSchema = z.object({
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
export type GroqChatCompletion = z.infer<typeof GroqChatCompletionSchema>;

export const GroqErrorEnvelopeSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
  }),
});
