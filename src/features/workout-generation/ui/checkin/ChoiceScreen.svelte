<script lang="ts">
  import { resolveChoice } from '../api-client';

  interface Props {
    checkInId: string;
  }

  const { checkInId }: Props = $props();

  let submitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let resolved = $state<'ACTIVE_RECOVERY_WALK' | 'REST' | null>(null);

  async function choose(selection: 'ACTIVE_RECOVERY_WALK' | 'REST') {
    submitting = true;
    errorMessage = null;

    const result = await resolveChoice(checkInId, selection);

    submitting = false;
    if (!result.ok) {
      errorMessage = 'Could not save your choice. Please try again.';
      return;
    }
    resolved = selection;
  }
</script>

{#if resolved}
  <p class="result-copy">
    {resolved === 'REST' ? "Today's a rest day. Enjoy it." : 'Your active recovery walk is ready.'}
  </p>
{:else}
  <h1>Low energy, some time to spare</h1>
  <p class="dek">You could go for an easy walk, or take a full rest day — your call.</p>
  <div class="stack" role="group" aria-label="Today's choice">
    <button type="button" class="big-btn" disabled={submitting} onclick={() => choose('ACTIVE_RECOVERY_WALK')}>
      Go for a walk
    </button>
    <button type="button" class="big-btn" disabled={submitting} onclick={() => choose('REST')}>Rest today</button>
  </div>
  {#if errorMessage}
    <p class="error-text" role="alert">{errorMessage}</p>
  {/if}
{/if}

<style>
  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0 0 var(--space-3);
  }

  .dek {
    color: var(--ink-soft);
    font-size: 1rem;
    margin: 0 0 var(--space-6);
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
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
  }

  .big-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .result-copy {
    font-size: 1.0625rem;
  }

  .error-text {
    color: var(--danger);
    font-size: 0.9375rem;
    margin-top: var(--space-3);
  }
</style>
