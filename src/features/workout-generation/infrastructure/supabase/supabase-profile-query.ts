import type { SupabaseClient } from '@supabase/supabase-js';
import { Goal } from '../../domain/generator/generator.constants';

// Read-only: full profile CRUD (goal/level/default equipment) belongs to
// the not-yet-built profile endpoints (ADR-0011 decision 5). This is only
// what /api/workouts/generate needs to build a PlanRequest.
export async function getProfileGoal(client: SupabaseClient, userId: string): Promise<Goal | null> {
  const { data, error } = await client.from('user_profiles').select('goal').eq('user_id', userId).maybeSingle();

  if (error || !data) {
    if (error) console.warn('[profile-query] db error', error.message);
    return null;
  }

  const parsed = Goal.safeParse(data.goal);
  return parsed.success ? parsed.data : null;
}
