<script lang="ts">
  import { authorizedFetch } from '../../../../shared/http/authorized-fetch';

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

    const response = await authorizedFetch(`/api/checkin/${checkInId}/choice`, {
      method: 'POST',
      body: JSON.stringify({ selection }),
    });

    submitting = false;
    if (!response.ok) {
      errorMessage = 'Could not save your choice. Please try again.';
      return;
    }
    resolved = selection;
  }
</script>

{#if resolved}
  <p>
    {resolved === 'REST' ? "Today's a rest day. Enjoy it." : 'Your active recovery walk is ready.'}
  </p>
{:else}
  <h1>Low energy, some time to spare</h1>
  <p>You could go for an easy walk, or take a full rest day — your call.</p>
  <div role="group" aria-label="Today's choice">
    <button type="button" disabled={submitting} onclick={() => choose('ACTIVE_RECOVERY_WALK')}>
      Go for a walk
    </button>
    <button type="button" disabled={submitting} onclick={() => choose('REST')}>Rest today</button>
  </div>
  {#if errorMessage}
    <p role="alert">{errorMessage}</p>
  {/if}
{/if}
