import { z } from 'zod';

// Shared by skip-exercise and end-session (ADR-0009 decision 2) — a
// single-tap, optional, informational-only tag (decision 3: never feeds
// back into TrainingDecision or a Limitation).
export const StopReason = z.enum(['pain', 'time', 'other']);
export type StopReason = z.infer<typeof StopReason>;
