// Runs once before all E2E specs (docs/adr/0012-test-strategy.md decision
// 4). Provisions two already-onboarded test users directly via the
// service-role client — public signup is disabled, and onboarding itself
// isn't what these specs are testing, so seeding a profile here keeps each
// spec focused on its named scenario (golden path / CHOICE branch).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CHOICE_USER, GOLDEN_PATH_USER, PASSWORD, TEST_PROFILE } from './test-users';

async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  return data.users.find((u) => u.email === email)?.id ?? null;
}

async function ensureUser(admin: SupabaseClient, email: string): Promise<string> {
  const existing = await findUserIdByEmail(admin, email);
  if (existing) return existing;

  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw error ?? new Error(`Could not create ${email}`);
  return data.user.id;
}

export default async function globalSetup(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('E2E setup needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set to a running local Supabase instance.');
  }

  const admin = createClient(url, serviceRoleKey);
  const today = new Date().toISOString().slice(0, 10);

  for (const { email } of [GOLDEN_PATH_USER, CHOICE_USER]) {
    const userId = await ensureUser(admin, email);

    const { error: profileError } = await admin.from('user_profiles').upsert({
      user_id: userId,
      goal: TEST_PROFILE.goal,
      level: TEST_PROFILE.level,
      default_equipment_context: TEST_PROFILE.defaultEquipmentContext,
      data_consent_at: new Date().toISOString(),
    });
    if (profileError) throw profileError;

    // Idempotent for repeated local runs against the same day — CI always
    // starts from a fresh local Supabase so this is a no-op there.
    const { error: cleanupError } = await admin.from('daily_checkins').delete().eq('user_id', userId).eq('date', today);
    if (cleanupError) throw cleanupError;
  }
}
