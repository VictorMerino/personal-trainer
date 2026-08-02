import { z } from 'zod';

const RepRangeSchema = z.object({
  min: z.number().int().positive(),
  max: z.number().int().positive(),
});

const RpeTarget = z.number().min(0).max(10);

// ADR-0002 decision 1: keyed by progression kind so a set can't carry a
// field that makes no sense for it (e.g. loadKg on a time-based plank).
export const SetTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('load'),
    reps: RepRangeSchema,
    loadKg: z.number().positive(),
    rpeTarget: RpeTarget,
  }),
  z.strictObject({
    kind: z.literal('reps'),
    reps: RepRangeSchema,
    rpeTarget: RpeTarget,
  }),
  z.strictObject({
    kind: z.literal('time'),
    seconds: z.number().int().positive(),
    rpeTarget: RpeTarget,
  }),
]);

export type SetTarget = z.infer<typeof SetTargetSchema>;
