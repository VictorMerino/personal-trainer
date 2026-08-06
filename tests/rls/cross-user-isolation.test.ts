// RLS integration tests (docs/adr/0012-test-strategy.md decision 3): two
// authenticated supabase-js clients against a real local Supabase instance
// (Docker, started via `supabase start` — see package.json's `test:rls`
// script and .github/workflows/ci.yml's `rls` job), asserting cross-user
// isolation with the exact client the app itself uses. Not run by the
// default `pnpm test` — these need a live local Supabase, unlike every
// other suite in this repo.
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error(
    'RLS tests need SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY set to a running local Supabase instance (`supabase start`, then read them from its output).',
  );
}

// eslint-disable-next-line sonarjs/no-hardcoded-passwords -- ephemeral password for throwaway test users on a local-only Supabase instance, deleted in afterAll.
const password = 'password123!';

async function createSignedInUser(admin: SupabaseClient, email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error(`Could not create test user ${email}`);

  const client = createClient(url!, anonKey!);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { userId: data.user.id, client };
}

describe('RLS: cross-user isolation (docs/features/data-model-rls.md)', () => {
  const admin = createClient(url!, serviceRoleKey!);
  const runId = randomUUID();

  let userA: { userId: string; client: SupabaseClient };
  let userB: { userId: string; client: SupabaseClient };

  beforeAll(async () => {
    userA = await createSignedInUser(admin, `a-${runId}@rls-test.local`);
    userB = await createSignedInUser(admin, `b-${runId}@rls-test.local`);
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(userA.userId);
    await admin.auth.admin.deleteUser(userB.userId);
  });

  it('a user cannot read another user\'s daily_checkins', async () => {
    const { data: checkIn, error } = await userA.client
      .from('daily_checkins')
      .insert({
        user_id: userA.userId,
        date: '2026-08-06',
        energy: 'low',
        available_minutes: 30,
        equipment_context: 'basic',
        decision: { kind: 'NORMAL' },
      })
      .select()
      .single();
    expect(error).toBeNull();

    const { data: seenByB } = await userB.client.from('daily_checkins').select('*').eq('id', checkIn!.id);
    expect(seenByB).toEqual([]);

    const { data: allSeenByB } = await userB.client.from('daily_checkins').select('*').eq('user_id', userA.userId);
    expect(allSeenByB).toEqual([]);
  });

  it('a user cannot read, update, or delete another user\'s workout_plans', async () => {
    const plan = { mode: 'NORMAL', blocks: [], generatedBy: 'deterministic', schemaVersion: 1, promptVersion: null };
    const { data: stored, error } = await userA.client
      .from('workout_plans')
      .insert({
        user_id: userA.userId,
        date: '2026-08-06',
        mode: 'NORMAL',
        generated_by: 'deterministic',
        schema_version: 1,
        prompt_version: null,
        plan,
      })
      .select()
      .single();
    expect(error).toBeNull();

    const { data: seenByB } = await userB.client.from('workout_plans').select('*').eq('id', stored!.id);
    expect(seenByB).toEqual([]);

    const { data: updatedByB } = await userB.client
      .from('workout_plans')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', stored!.id)
      .select();
    expect(updatedByB).toEqual([]);

    const { data: afterUpdateAttempt } = await userA.client.from('workout_plans').select('ended_at').eq('id', stored!.id).single();
    expect(afterUpdateAttempt?.ended_at).toBeNull();

    const { data: deletedByB } = await userB.client.from('workout_plans').delete().eq('id', stored!.id).select();
    expect(deletedByB).toEqual([]);

    const { data: stillThere } = await userA.client.from('workout_plans').select('id').eq('id', stored!.id).single();
    expect(stillThere?.id).toBe(stored!.id);
  });

  it('a user cannot read another user\'s set_logs', async () => {
    const plan = { mode: 'NORMAL', blocks: [], generatedBy: 'deterministic', schemaVersion: 1, promptVersion: null };
    const { data: stored } = await userA.client
      .from('workout_plans')
      .insert({
        user_id: userA.userId,
        date: '2026-08-06',
        mode: 'NORMAL',
        generated_by: 'deterministic',
        schema_version: 1,
        prompt_version: null,
        plan,
      })
      .select()
      .single();

    const { error: logError } = await userA.client.from('set_logs').insert({
      user_id: userA.userId,
      workout_plan_id: stored!.id,
      exercise_id: 'bodyweight-squat',
      movement_pattern: 'knee-dominant',
      set_index: 0,
      actual_reps: 10,
      actual_rpe: 7,
    });
    expect(logError).toBeNull();

    const { data: seenByB } = await userB.client.from('set_logs').select('*').eq('workout_plan_id', stored!.id);
    expect(seenByB).toEqual([]);
  });
});
