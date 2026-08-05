import { z } from 'zod';

// GET /api/progress?range=... (ADR-0011) — a fixed enum rather than
// arbitrary start/end dates, since nothing in the MVP needs a custom
// range yet (ADR-0010 decision 3 only names an 8-week default).
export const ProgressRange = z.enum(['4w', '8w', '12w']);
export type ProgressRange = z.infer<typeof ProgressRange>;

export const DEFAULT_PROGRESS_RANGE: ProgressRange = '8w';

export const PROGRESS_RANGE_DAYS: Readonly<Record<ProgressRange, number>> = {
  '4w': 28,
  '8w': 56,
  '12w': 84,
};
