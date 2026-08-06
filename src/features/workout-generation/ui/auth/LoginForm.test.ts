// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginForm from './LoginForm.svelte';

const signInWithPassword = vi.fn();

vi.mock('../../../../shared/supabase/browser-client', () => ({
  getSupabaseBrowserClient: () => ({ auth: { signInWithPassword } }),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
  });

  it('signs in with the entered credentials and navigates to redirectTo on success', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: null });
    const user = userEvent.setup();
    render(LoginForm, { redirectTo: '/onboarding' });

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'hunter2');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'hunter2' });
    await vi.waitFor(() => expect(window.location.href).toBe('/onboarding'));
  });

  it('shows an error and does not navigate when sign-in fails', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: { message: 'invalid' } });
    const user = userEvent.setup();
    render(LoginForm, { redirectTo: '/onboarding' });

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Could not sign in');
    expect(window.location.href).toBe('');
  });
});
