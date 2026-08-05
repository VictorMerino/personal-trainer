import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { LimitationSchema, type Limitation } from '../../domain/limitation.schema';

const LimitationRowSchema = z.object({ zone: z.string(), severity: z.string(), status: z.string() });

// Read-only: full limitations CRUD belongs to the not-yet-built profile
// endpoints (ADR-0011 decision 5). This is only what the check-in/choice
// endpoints need to compute effectiveLimitationsForToday.
export async function getActiveLimitations(client: SupabaseClient, userId: string): Promise<readonly Limitation[]> {
  const { data, error } = await client
    .from('limitations')
    .select('zone, severity, status')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    console.warn('[limitations-query] db error', error.message);
    return [];
  }

  const limitations: Limitation[] = [];
  for (const row of data ?? []) {
    const parsedRow = LimitationRowSchema.safeParse(row);
    if (!parsedRow.success) continue;

    const parsed = LimitationSchema.safeParse({
      zone: parsedRow.data.zone,
      severity: parsedRow.data.severity,
      isActive: parsedRow.data.status === 'active',
    });
    if (parsed.success) limitations.push(parsed.data);
  }

  return limitations;
}
