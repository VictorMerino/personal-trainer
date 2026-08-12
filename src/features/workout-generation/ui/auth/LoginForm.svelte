<script lang="ts">
  import { getSupabaseBrowserClient } from '../../../../shared/supabase/browser-client';

  interface Props {
    // A callback prop here would silently never fire: Astro serializes
    // client:load island props to JSON to send them to the client, and a
    // function passed from the .astro file's template doesn't survive that
    // — this used to be `onsignedin={() => (window.location.href = '/onboarding')}`
    // in login.astro, which never actually ran in the real app (only in
    // component tests that instantiate this component directly, bypassing
    // Astro's serialization boundary entirely). A string prop is
    // serializable and the component navigates itself instead.
    redirectTo?: string;
  }

  const { redirectTo = '/' }: Props = $props();

  let email = $state('');
  let password = $state('');
  let submitting = $state(false);
  let errorMessage = $state<string | null>(null);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    submitting = true;
    errorMessage = null;

    try {
      const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
      if (error) {
        errorMessage = 'Could not sign in. Check your email and password.';
        return;
      }
      window.location.href = redirectTo;
    } catch (err) {
      console.error('[login] sign-in failed', err);
      errorMessage = 'Something went wrong signing you in. Please try again later.';
    } finally {
      submitting = false;
    }
  }
</script>

<form class="stack" onsubmit={handleSubmit}>
  <label class="field">
    <span class="field-label">Email</span>
    <input
      class="field-input"
      type="email"
      bind:value={email}
      autocomplete="email"
      required
      disabled={submitting}
    />
  </label>
  <label class="field">
    <span class="field-label">Password</span>
    <input
      class="field-input"
      type="password"
      bind:value={password}
      autocomplete="current-password"
      required
      disabled={submitting}
    />
  </label>
  <button type="submit" class="big-btn" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
  {#if errorMessage}
    <p class="error-text" role="alert">{errorMessage}</p>
  {/if}
</form>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .field-label {
    font-family: var(--font-data);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-soft);
  }

  .field-input {
    font-family: var(--font-ui);
    font-size: 1rem;
    color: var(--ink);
    background: var(--paper-raised);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: var(--space-3) var(--space-4);
  }

  .field-input:disabled {
    opacity: 0.6;
  }

  .big-btn {
    display: block;
    width: 100%;
    font-family: var(--font-ui);
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--paper-raised);
    background: var(--accent-strong);
    border: none;
    border-radius: var(--radius);
    padding: var(--space-5) var(--space-4);
    text-align: center;
    cursor: pointer;
    margin-top: var(--space-2);
  }

  .big-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .error-text {
    color: var(--danger);
    font-size: 0.9375rem;
    margin: 0;
  }
</style>
