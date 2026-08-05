// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RpeBar from './RpeBar.svelte';

describe('RpeBar', () => {
  it('renders ten selectable cells in input mode and reports taps', async () => {
    const user = userEvent.setup();
    const onchange = vi.fn();
    render(RpeBar, { mode: 'input', onchange });

    const cells = screen.getAllByRole('button');
    expect(cells).toHaveLength(10);

    await user.click(screen.getByRole('button', { name: '7' }));

    expect(onchange).toHaveBeenCalledWith(7);
  });

  it('renders as a read-only display when reviewing a past set', () => {
    render(RpeBar, { mode: 'display', value: 6 });

    const selected = screen.getByRole('button', { name: '6' });
    expect(selected).toBeDisabled();
    expect(selected).toHaveAttribute('aria-pressed', 'true');
  });
});
