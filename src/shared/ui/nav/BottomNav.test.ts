// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BottomNav from './BottomNav.svelte';

const authorizedFetch = vi.fn();

vi.mock('../../../shared/http/authorized-fetch', () => ({
  authorizedFetch: (...args: unknown[]) => authorizedFetch(...args),
}));

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return { ok, status, json: () => Promise.resolve(body) };
}

describe('BottomNav', () => {
  beforeEach(() => {
    authorizedFetch.mockReset();
  });

  it('links to /app and /progress, marking the active tab', async () => {
    authorizedFetch.mockResolvedValueOnce(jsonResponse({}, false, 404));
    render(BottomNav, { active: 'home' });

    const homeLink = screen.getByRole('link', { name: /home/i });
    const progressLink = screen.getByRole('link', { name: /progress/i });
    expect(homeLink).toHaveAttribute('href', '/app');
    expect(homeLink).toHaveAttribute('aria-current', 'page');
    expect(progressLink).toHaveAttribute('href', '/progress');
    expect(progressLink).not.toHaveAttribute('aria-current');
  });

  it('shows no badge when there is no check-in yet today', async () => {
    authorizedFetch.mockResolvedValueOnce(jsonResponse({}, false, 404));
    render(BottomNav, { active: 'home' });

    await vi.waitFor(() => expect(authorizedFetch).toHaveBeenCalled());
    expect(screen.queryByLabelText("Today's plan resolved")).not.toBeInTheDocument();
  });

  it('shows the badge on a rest day', async () => {
    authorizedFetch.mockResolvedValueOnce(
      jsonResponse({ checkInId: 'ci-1', decision: { kind: 'REST' }, plan: null }),
    );
    render(BottomNav, { active: 'progress' });

    expect(await screen.findByLabelText("Today's plan resolved")).toBeInTheDocument();
  });

  it('shows the badge on an active-recovery day', async () => {
    authorizedFetch.mockResolvedValueOnce(
      jsonResponse({ checkInId: 'ci-1', decision: { kind: 'ACTIVE_RECOVERY', reason: 'severe-pain' }, plan: null }),
    );
    render(BottomNav, { active: 'home' });

    expect(await screen.findByLabelText("Today's plan resolved")).toBeInTheDocument();
  });

  it('shows the badge once a normal-day workout is finished', async () => {
    authorizedFetch.mockResolvedValueOnce(
      jsonResponse({ checkInId: 'ci-1', decision: { kind: 'NORMAL' }, plan: { id: 'plan-1', endedAt: '2026-08-06T00:00:00Z' } }),
    );
    render(BottomNav, { active: 'home' });

    expect(await screen.findByLabelText("Today's plan resolved")).toBeInTheDocument();
  });

  it('does not show the badge for an unfinished normal-day workout', async () => {
    authorizedFetch.mockResolvedValueOnce(
      jsonResponse({ checkInId: 'ci-1', decision: { kind: 'NORMAL' }, plan: { id: 'plan-1', endedAt: null } }),
    );
    render(BottomNav, { active: 'home' });

    await vi.waitFor(() => expect(authorizedFetch).toHaveBeenCalled());
    expect(screen.queryByLabelText("Today's plan resolved")).not.toBeInTheDocument();
  });
});
