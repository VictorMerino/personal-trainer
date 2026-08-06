// eslint-disable-next-line sonarjs/no-hardcoded-passwords -- ephemeral password for throwaway test users on a local-only Supabase instance.
export const PASSWORD = 'password123!';

export const GOLDEN_PATH_USER = { email: 'e2e-golden-path@rls-test.local' };
export const CHOICE_USER = { email: 'e2e-choice-branch@rls-test.local' };

export const TEST_PROFILE = {
  goal: 'general_fitness' as const,
  level: 'beginner' as const,
  defaultEquipmentContext: 'basic' as const,
};
