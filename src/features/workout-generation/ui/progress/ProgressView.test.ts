// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProgressView from './ProgressView.svelte';

const authorizedFetch = vi.fn();

vi.mock('../../../../shared/http/authorized-fetch', () => ({
  authorizedFetch: (...args: unknown[]) => authorizedFetch(...args),
}));

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) };
}

function snapshot(overrides: Partial<{ loggedSets: number; prescribedSets: number; ratio: number }> = {}) {
  return {
    adherence: { loggedSets: 12, prescribedSets: 16, ratio: 0.75, ...overrides },
    volumePerPattern: {
      'knee-dominant': 8,
      'hip-dominant': 4,
      'unilateral-leg': 0,
      'horizontal-push': 0,
      'vertical-push': 0,
      'horizontal-pull': 0,
      'vertical-pull': 0,
      'core-antiextension': 0,
      'core-antirotation': 0,
      locomotion: 0,
    },
  };
}

describe('ProgressView', () => {
  beforeEach(() => {
    authorizedFetch.mockReset();
  });

  it('loads the default 8-week range on mount and shows adherence + volume', async () => {
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ range: '8w', snapshot: snapshot() }));
    render(ProgressView);

    expect(await screen.findByText(/12 of 16 sets logged \(75%\)/)).toBeInTheDocument();
    expect(authorizedFetch).toHaveBeenCalledWith('/api/progress?range=8w', { method: 'GET' });
    expect(screen.getByText('knee-dominant')).toBeInTheDocument();
    expect(screen.queryByText('locomotion')).not.toBeInTheDocument();
  });

  it('re-fetches when a different range is selected', async () => {
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ range: '8w', snapshot: snapshot() }));
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ range: '4w', snapshot: snapshot({ loggedSets: 5, prescribedSets: 5, ratio: 1 }) }));
    const user = userEvent.setup();
    render(ProgressView);

    await screen.findByText(/12 of 16 sets logged/);
    await user.click(screen.getByRole('button', { name: '4w' }));

    expect(authorizedFetch).toHaveBeenLastCalledWith('/api/progress?range=4w', { method: 'GET' });
    expect(await screen.findByText(/5 of 5 sets logged \(100%\)/)).toBeInTheDocument();
  });

  it('shows a fallback message when nothing has been logged in range', async () => {
    const emptySnapshot = {
      adherence: { loggedSets: 0, prescribedSets: 0, ratio: 0 },
      volumePerPattern: Object.fromEntries(Object.keys(snapshot().volumePerPattern).map((k) => [k, 0])),
    };
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ range: '8w', snapshot: emptySnapshot }));
    render(ProgressView);

    expect(await screen.findByText('No logged sets in this range yet.')).toBeInTheDocument();
  });

  it('shows an error message when the fetch fails', async () => {
    authorizedFetch.mockResolvedValueOnce(jsonResponse({}, false));
    render(ProgressView);

    expect(await screen.findByText('Could not load your progress.')).toBeInTheDocument();
  });
});
