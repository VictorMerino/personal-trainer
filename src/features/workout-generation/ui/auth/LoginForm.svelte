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
