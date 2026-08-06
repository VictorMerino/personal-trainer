// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomeView from './HomeView.svelte';

const authorizedFetch = vi.fn();

vi.mock('../../../../shared/http/authorized-fetch', () => ({
  authorizedFetch: (...args: unknown[]) => authorizedFetch(...args),
}));

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return { ok, status, json: () => Promise.resolve(body) };
}

describe('HomeView', () => {
  beforeEach(() => {
    authorizedFetch.mockReset();
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
  });

  it('redirects to /checkin when no check-in exists for today', async () => {
    authorizedFetch.mockResolvedValueOnce(jsonResponse({}, false, 404));
    render(HomeView);

    await vi.waitFor(() => expect(window.location.href).toBe('/checkin'));
  });

  it('redirects to the choice screen for an unresolved CHOICE', async () => {
    authorizedFetch.mockResolvedValueOnce(
      jsonResponse({ checkInId: 'ci-1', decision: { kind: 'CHOICE', options: ['ACTIVE_RECOVERY_WALK', 'REST'] }, plan: null }),
    );
    render(HomeView);

    await vi.waitFor(() => expect(window.location.href).toBe('/checkin/ci-1/choice'));
  });

  it('offers to resume an in-progress workout', async () => {
    authorizedFetch.mockResolvedValueOnce(
      jsonResponse({ checkInId: 'ci-1', decision: { kind: 'NORMAL' }, plan: { id: 'plan-1', endedAt: null } }),
    );
    render(HomeView);

    const link = await screen.findByRole('link', { name: "Resume today's workout" });
    expect(link).toHaveAttribute('href', '/workout/plan-1');
  });

  it('shows a completed message once the workout has ended', async () => {
    authorizedFetch.mockResolvedValueOnce(
      jsonResponse({ checkInId: 'ci-1', decision: { kind: 'DELOAD' }, plan: { id: 'plan-1', endedAt: '2026-08-06T00:00:00Z' } }),
    );
    render(HomeView);

    expect(await screen.findByText("Today's workout is complete.")).toBeInTheDocument();
  });

  it('offers to generate a workout when the check-in resolved but no plan exists yet', async () => {
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ checkInId: 'ci-1', decision: { kind: 'NORMAL' }, plan: null }));
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ id: 'plan-2', plan: {} }));
    const user = userEvent.setup();
    render(HomeView);

    const generateButton = await screen.findByRole('button', { name: "Generate today's workout" });
    await user.click(generateButton);

    expect(authorizedFetch).toHaveBeenLastCalledWith('/api/workouts/generate', { method: 'POST' });
    await vi.waitFor(() => expect(window.location.href).toBe('/workout/plan-2'));
  });

  it('shows an active-recovery message with a link to progress', async () => {
    authorizedFetch.mockResolvedValueOnce(
      jsonResponse({ checkInId: 'ci-1', decision: { kind: 'ACTIVE_RECOVERY', reason: 'severe-pain' }, plan: null }),
    );
    render(HomeView);

    expect(await screen.findByText('Today is an active recovery day.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View progress' })).toHaveAttribute('href', '/progress');
  });
});
