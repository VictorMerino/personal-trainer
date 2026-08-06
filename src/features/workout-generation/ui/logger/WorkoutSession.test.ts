// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkoutSession from './WorkoutSession.svelte';

const authorizedFetch = vi.fn();

vi.mock('../../../../shared/http/authorized-fetch', () => ({
  authorizedFetch: (...args: unknown[]) => authorizedFetch(...args),
}));

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) };
}

const plan = {
  mode: 'NORMAL',
  blocks: [
    {
      role: 'main',
      exercises: [
        {
          exerciseId: 'bodyweight-squat',
          sets: [
            { kind: 'reps', reps: { min: 8, max: 12 }, rpeTarget: 7 },
            { kind: 'reps', reps: { min: 8, max: 12 }, rpeTarget: 7 },
          ],
        },
      ],
    },
  ],
  generatedBy: 'deterministic',
  schemaVersion: 1,
  promptVersion: null,
};

describe('WorkoutSession', () => {
  beforeEach(() => {
    authorizedFetch.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the plan and logs a set immediately, no separate save step', async () => {
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ id: 'plan-1', plan, endedAt: null }));
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(WorkoutSession, { planId: 'plan-1' });

    await screen.findByRole('heading', { name: /squat/i });

    const rpeGroup = screen.getByRole('group', { name: /RPE/i });
    await user.click(within(rpeGroup).getByRole('button', { name: '8' }));
    await user.click(screen.getByRole('button', { name: 'Log set' }));

    expect(authorizedFetch).toHaveBeenLastCalledWith(
      '/api/workouts/plan-1/sets',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          exerciseId: 'bodyweight-squat',
          setIndex: 0,
          actualRpe: 8,
          actualReps: 8,
          actualLoadKg: null,
          actualSeconds: null,
        }),
      }),
    );

    await screen.findByText('Set 2 of 2');
  });

  it('starts the rest timer immediately after a set is logged and announces at start/halfway/zero', async () => {
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ id: 'plan-1', plan, endedAt: null }));
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(WorkoutSession, { planId: 'plan-1' });

    await screen.findByRole('heading', { name: /squat/i });
    const rpeGroup = screen.getByRole('group', { name: /RPE/i });
    await user.click(within(rpeGroup).getByRole('button', { name: '8' }));
    await user.click(screen.getByRole('button', { name: 'Log set' }));

    const liveRegion = screen.getByText(/Resting for/);
    expect(liveRegion).toHaveAttribute('aria-live', 'assertive');

    await vi.advanceTimersByTimeAsync(30_000);
    expect(screen.getByText('Halfway through your rest')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(screen.getByText('Rest complete')).toBeInTheDocument();
  });

  it('skips an exercise and advances without logging a set', async () => {
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ id: 'plan-1', plan, endedAt: null }));
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(WorkoutSession, { planId: 'plan-1' });

    await screen.findByRole('heading', { name: /squat/i });
    await user.click(screen.getByRole('button', { name: 'Skip exercise' }));

    expect(authorizedFetch).toHaveBeenLastCalledWith(
      '/api/workouts/plan-1/skip-exercise',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ exerciseId: 'bodyweight-squat', reason: null }),
      }),
    );
    await screen.findByText('All sets logged for today.');
  });

  it('ends the session on demand', async () => {
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ id: 'plan-1', plan, endedAt: null }));
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ ok: true, endedAt: '2026-08-06T00:00:00Z' }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(WorkoutSession, { planId: 'plan-1' });

    await screen.findByRole('heading', { name: /squat/i });
    await user.click(screen.getByRole('button', { name: 'End session' }));

    expect(authorizedFetch).toHaveBeenLastCalledWith(
      '/api/workouts/plan-1/end',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ reason: null }) }),
    );
    expect(await screen.findByText('Workout session finished. Nice work.')).toBeInTheDocument();
  });

  it('shows a finished message if the session was already ended', async () => {
    authorizedFetch.mockResolvedValueOnce(jsonResponse({ id: 'plan-1', plan, endedAt: '2026-08-06T00:00:00Z' }));
    render(WorkoutSession, { planId: 'plan-1' });

    expect(await screen.findByText('Workout session finished. Nice work.')).toBeInTheDocument();
  });
});
