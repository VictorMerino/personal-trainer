// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChoiceScreen from './ChoiceScreen.svelte';

const authorizedFetch = vi.fn();

vi.mock('../../../../shared/http/authorized-fetch', () => ({
  authorizedFetch: (...args: unknown[]) => authorizedFetch(...args),
}));

describe('ChoiceScreen', () => {
  beforeEach(() => {
    authorizedFetch.mockReset();
  });

  it('presents both options with no default selection', () => {
    render(ChoiceScreen, { checkInId: 'ci-1' });

    const walk = screen.getByRole('button', { name: 'Go for a walk' });
    const rest = screen.getByRole('button', { name: 'Rest today' });
    expect(walk).not.toBeDisabled();
    expect(rest).not.toBeDisabled();
    expect(walk.className).toBe(rest.className);
  });

  it('resolves the choice against the check-in id', async () => {
    authorizedFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ decision: { kind: 'REST' } }) });
    const user = userEvent.setup();
    render(ChoiceScreen, { checkInId: 'ci-7' });

    await user.click(screen.getByRole('button', { name: 'Rest today' }));

    expect(authorizedFetch).toHaveBeenCalledWith(
      '/api/checkin/ci-7/choice',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ selection: 'REST' }) }),
    );
    await screen.findByText(/rest day/);
  });
});
