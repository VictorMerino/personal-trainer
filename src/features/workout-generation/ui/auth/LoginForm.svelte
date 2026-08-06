<script lang="ts">
  import { getSupabaseBrowserClient } from '../../../../shared/supabase/browser-client';

  interface Props {
    onsignedin?: () => void;
  }

  const { onsignedin }: Props = $props();

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
      onsignedin?.();
    } catch (err) {
      console.error('[login] sign-in failed', err);
      errorMessage = 'Something went wrong signing you in. Please try again later.';
    } finally {
      submitting = false;
    }
  }
</script>

<form onsubmit={handleSubmit}>
  <label>
    Email
    <input type="email" bind:value={email} autocomplete="email" required disabled={submitting} />
  </label>
  <label>
    Password
    <input type="password" bind:value={password} autocomplete="current-password" required disabled={submitting} />
  </label>
  <button type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
  {#if errorMessage}
    <p role="alert">{errorMessage}</p>
  {/if}
</form>
