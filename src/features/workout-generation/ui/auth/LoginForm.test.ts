// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LoginForm from './LoginForm.svelte';

const signInWithPassword = vi.fn();

vi.mock('../../../../shared/supabase/browser-client', () => ({
  getSupabaseBrowserClient: () => ({ auth: { signInWithPassword } }),
}));

describe('LoginForm', () => {
  it('signs in with the entered credentials and notifies on success', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: null });
    const onsignedin = vi.fn();
    const user = userEvent.setup();
    render(LoginForm, { onsignedin });

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'hunter2');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'hunter2' });
    expect(onsignedin).toHaveBeenCalled();
  });

  it('shows an error and does not notify when sign-in fails', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: { message: 'invalid' } });
    const onsignedin = vi.fn();
    const user = userEvent.setup();
    render(LoginForm, { onsignedin });

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Could not sign in');
    expect(onsignedin).not.toHaveBeenCalled();
  });
});
