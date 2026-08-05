// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Skeleton from './Skeleton.svelte';

describe('Skeleton', () => {
  it('renders a status role placeholder with a default label', () => {
    render(Skeleton);

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('accepts a custom accessible label', () => {
    render(Skeleton, { label: 'Loading workout plan' });

    expect(screen.getByRole('status', { name: 'Loading workout plan' })).toBeInTheDocument();
  });
});
