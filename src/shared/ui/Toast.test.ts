// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Toast from './Toast.svelte';

describe('Toast', () => {
  it('announces info messages politely', () => {
    render(Toast, { message: 'Set saved' });

    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('Set saved');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });

  it('announces error messages assertively', () => {
    render(Toast, { message: 'Failed to save set', variant: 'error' });

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'assertive');
  });
});
