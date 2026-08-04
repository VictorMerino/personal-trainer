import { describe, expect, it, vi } from 'vitest';

const createClient = vi.fn(() => ({ mocked: true }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));

const { createSupabaseClient } = await import('./supabase-client');

describe('createSupabaseClient', () => {
  it('authenticates as the calling user via their access token, not a shared anon session', () => {
    createSupabaseClient({ url: 'https://project.supabase.co', anonKey: 'anon-key' }, 'user-jwt');

    expect(createClient).toHaveBeenCalledWith('https://project.supabase.co', 'anon-key', {
      global: { headers: { Authorization: 'Bearer user-jwt' } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });
});
