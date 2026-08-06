// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingForm from './OnboardingForm.svelte';

vi.mock('../../../../shared/supabase/browser-client', () => ({
  getAccessToken: () => Promise.resolve('test-token'),
}));

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) } as Response;
}

describe('OnboardingForm', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ profile: null, limitations: [] }, false)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lets the user pick goal, level and equipment, then saves the profile and navigates to redirectTo', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ profile: null, limitations: [] }, false));
    fetchMock.mockResolvedValueOnce(jsonResponse({ profile: {} }));

    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
    const user = userEvent.setup();
    render(OnboardingForm, { redirectTo: '/' });

    await screen.findByText('Goal');

    await user.click(screen.getByRole('button', { name: 'strength' }));
    await user.click(screen.getByRole('button', { name: 'beginner' }));
    await user.click(screen.getByRole('button', { name: 'basic' }));
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/profile',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ goal: 'strength', level: 'beginner', defaultEquipmentContext: 'basic' }),
      }),
    );
    await vi.waitFor(() => expect(window.location.href).toBe('/'));
  });

  it('blocks saving until goal, level and equipment are all chosen', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ profile: null, limitations: [] }, false));

    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
    const user = userEvent.setup();
    render(OnboardingForm, { redirectTo: '/' });

    await screen.findByText('Goal');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(screen.getByRole('alert')).toHaveTextContent('choose a goal');
    expect(window.location.href).toBe('');
  });
});
