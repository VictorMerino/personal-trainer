// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signInMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn(() => ({ auth: { getSession: signInMock } })));

vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));

describe('getSupabaseBrowserClient', () => {
  const originalUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const originalKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    vi.resetModules();
    import.meta.env.PUBLIC_SUPABASE_URL = originalUrl;
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });

  it('throws a clear, actionable error when Supabase config is missing, instead of a generic one', async () => {
    import.meta.env.PUBLIC_SUPABASE_URL = '';
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY = '';
    const { getSupabaseBrowserClient } = await import('./browser-client');

    expect(() => getSupabaseBrowserClient()).toThrow(/Supabase is not configured/);
  });

  it('creates a client when config is present', async () => {
    import.meta.env.PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    const { getSupabaseBrowserClient } = await import('./browser-client');

    expect(() => getSupabaseBrowserClient()).not.toThrow();
    expect(createClientMock).toHaveBeenCalledWith('https://example.supabase.co', 'anon-key');
  });
});

describe('requireSignedIn', () => {
  beforeEach(() => {
    vi.resetModules();
    signInMock.mockReset();
    createClientMock.mockClear();
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
    document.body.innerHTML = '';
  });

  it('redirects to /login when there is no session', async () => {
    import.meta.env.PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    signInMock.mockResolvedValue({ data: { session: null } });
    const { requireSignedIn } = await import('./browser-client');

    await requireSignedIn();

    expect(window.location.href).toBe('/login');
  });

  it('does not redirect when a session exists', async () => {
    import.meta.env.PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    signInMock.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    const { requireSignedIn } = await import('./browser-client');

    await requireSignedIn();

    expect(window.location.href).toBe('');
  });

  it('shows a readable error instead of an unhandled rejection when Supabase is misconfigured', async () => {
    import.meta.env.PUBLIC_SUPABASE_URL = '';
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY = '';
    const { requireSignedIn } = await import('./browser-client');

    await expect(requireSignedIn()).resolves.toBeUndefined();
    expect(document.body.textContent).toMatch(/went wrong/i);
  });
});
