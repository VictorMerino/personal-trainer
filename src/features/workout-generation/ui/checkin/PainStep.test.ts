// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PainStep from './PainStep.svelte';

describe('PainStep', () => {
  it('completes with no pain reports in a single tap', async () => {
    const oncomplete = vi.fn();
    const user = userEvent.setup();
    render(PainStep, { oncomplete });

    await user.click(screen.getByRole('button', { name: 'No pain today' }));

    expect(oncomplete).toHaveBeenCalledWith([]);
  });

  it('collects a level for each selected zone before allowing continue', async () => {
    const oncomplete = vi.fn();
    const user = userEvent.setup();
    render(PainStep, { oncomplete });

    await user.click(screen.getByRole('button', { name: 'I have pain' }));
    await user.click(screen.getByRole('button', { name: 'knee' }));
    await user.click(screen.getByRole('button', { name: 'shoulder' }));

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await user.click(screen.getByRole('group', { name: 'knee pain level' }).querySelector('button')!);
    await user.click(screen.getByRole('group', { name: 'shoulder pain level' }).querySelector('button')!);

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeEnabled();

    await user.click(continueButton);

    expect(oncomplete).toHaveBeenCalledWith([
      { zone: 'knee', level: 'mild' },
      { zone: 'shoulder', level: 'mild' },
    ]);
  });
});
