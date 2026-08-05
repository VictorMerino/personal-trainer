// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CheckInFlow from './CheckInFlow.svelte';

const authorizedFetch = vi.fn();

vi.mock('../../../../shared/http/authorized-fetch', () => ({
  authorizedFetch: (...args: unknown[]) => authorizedFetch(...args),
}));

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) };
}

async function completePainFreeSteps(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'low' }));
  await user.click(screen.getByRole('button', { name: 'No pain today' }));
  await user.click(screen.getByRole('button', { name: '30 min' }));
}

describe('CheckInFlow', () => {
  beforeEach(() => {
    authorizedFetch.mockReset();
  });

  it('submits a pain-free check-in after four steps', async () => {
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ decision: { kind: 'NORMAL' }, checkInId: 'ci-1' }));
    const user = userEvent.setup();
    render(CheckInFlow);

    await completePainFreeSteps(user);
    await user.click(screen.getByRole('button', { name: 'basic' }));

    expect(authorizedFetch).toHaveBeenCalledWith(
      '/api/checkin',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ energy: 'low', painReports: [], availableMinutes: 30, equipmentContext: 'basic' }),
      }),
    );
    await screen.findByText(/normal session/);
  });

  it('shows a generate-workout button for a NORMAL decision and disables it while generating', async () => {
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ decision: { kind: 'NORMAL' }, checkInId: 'ci-1' }));
    let resolveGenerate: (v: unknown) => void = () => {};
    authorizedFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveGenerate = resolve;
        }),
    );
    const user = userEvent.setup();
    render(CheckInFlow);

    await completePainFreeSteps(user);
    await user.click(screen.getByRole('button', { name: 'basic' }));

    const generateButton = await screen.findByRole('button', { name: "Generate today's workout" });
    await user.click(generateButton);

    expect(generateButton).toBeDisabled();
    resolveGenerate(jsonResponse({ plan: {} }));
    await screen.findByRole('button', { name: 'Workout ready' });
  });

  it('shows an active-recovery confirmation with no generate button', async () => {
    authorizedFetch.mockResolvedValueOnce(
      jsonResponse({ decision: { kind: 'ACTIVE_RECOVERY', reason: 'severe-pain' }, checkInId: 'ci-1' }),
    );
    const user = userEvent.setup();
    render(CheckInFlow);

    await completePainFreeSteps(user);
    await user.click(screen.getByRole('button', { name: 'basic' }));

    await screen.findByText(/active recovery day/);
    expect(screen.queryByRole('button', { name: "Generate today's workout" })).not.toBeInTheDocument();
  });

  it('navigates to the dedicated choice screen for a CHOICE decision', async () => {
    authorizedFetch.mockResolvedValueOnce(
      jsonResponse({
        decision: { kind: 'CHOICE', options: ['ACTIVE_RECOVERY_WALK', 'REST'] },
        checkInId: 'ci-42',
      }),
    );
    const user = userEvent.setup();
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
    render(CheckInFlow);

    await completePainFreeSteps(user);
    await user.click(screen.getByRole('button', { name: 'basic' }));

    await vi.waitFor(() => expect(window.location.href).toBe('/checkin/ci-42/choice'));
  });
});
