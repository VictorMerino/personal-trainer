// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DemoBanner from './DemoBanner.svelte';

const getCurrentUserId = vi.fn();

vi.mock('../supabase/browser-client', () => ({
  getCurrentUserId: () => getCurrentUserId(),
}));

describe('DemoBanner', () => {
  const original = import.meta.env.PUBLIC_DEMO_USER_IDS;

  afterEach(() => {
    import.meta.env.PUBLIC_DEMO_USER_IDS = original;
    getCurrentUserId.mockReset();
  });

  it('renders nothing when signed out', async () => {
    getCurrentUserId.mockResolvedValueOnce(null);
    render(DemoBanner);

    await vi.waitFor(() => expect(getCurrentUserId).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders nothing for a non-demo user', async () => {
    import.meta.env.PUBLIC_DEMO_USER_IDS = 'demo-1';
    getCurrentUserId.mockResolvedValueOnce('real-user');
    render(DemoBanner);

    await vi.waitFor(() => expect(getCurrentUserId).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the banner for a demo user', async () => {
    import.meta.env.PUBLIC_DEMO_USER_IDS = 'demo-1, demo-2';
    getCurrentUserId.mockResolvedValueOnce('demo-2');
    render(DemoBanner);

    expect(await screen.findByRole('status')).toHaveTextContent(/demo account/i);
  });
});
