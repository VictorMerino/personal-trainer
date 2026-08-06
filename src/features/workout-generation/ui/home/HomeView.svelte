<script lang="ts">
  import { generateWorkout as generateWorkoutRequest, getTodayStatus, type TodayStatus } from '../api-client';
  import Skeleton from '../../../../shared/ui/Skeleton.svelte';

  let loading = $state(true);
  let today = $state<TodayStatus | null>(null);
  let loadError = $state(false);
  let generating = $state(false);
  let generateError = $state<string | null>(null);

  async function loadToday() {
    try {
      const result = await getTodayStatus();
      loading = false;

      if (!result.ok) {
        if (result.status === 404) {
          window.location.href = '/checkin';
          return;
        }
        loadError = true;
        return;
      }

      today = result.value;
      if (result.value.decision.kind === 'CHOICE') {
        window.location.href = `/checkin/${result.value.checkInId}/choice`;
      }
    } catch (err) {
      console.error('[home] failed to load today\'s status', err);
      loading = false;
      loadError = true;
    }
  }

  loadToday();

  async function generateWorkout() {
    generating = true;
    generateError = null;

    const result = await generateWorkoutRequest();
    if (!result.ok) {
      generating = false;
      generateError = 'Could not generate a workout. Please try again.';
      return;
    }
    window.location.href = `/workout/${result.value.id}`;
  }
</script>

<h1>Personal-TrAIner</h1>

{#if loading}
  <Skeleton height="6rem" label="Loading today's status" />
{:else if loadError}
  <p role="alert">Could not load today's status.</p>
{:else if today && today.decision.kind !== 'CHOICE'}
  {#if today.decision.kind === 'ACTIVE_RECOVERY'}
    <p>Today is an active recovery day.</p>
  {:else if today.decision.kind === 'REST'}
    <p>Today's a rest day.</p>
  {:else if today.plan}
    {#if today.plan.endedAt}
      <p>Today's workout is complete.</p>
    {:else}
      <a href={`/workout/${today.plan.id}`}>Resume today's workout</a>
    {/if}
  {:else}
    <button type="button" disabled={generating} onclick={generateWorkout}>
      {generating ? 'Generating…' : "Generate today's workout"}
    </button>
    {#if generateError}
      <p role="alert">{generateError}</p>
    {/if}
  {/if}

  <nav>
    <a href="/progress">View progress</a>
  </nav>
{/if}
