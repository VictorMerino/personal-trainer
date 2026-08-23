<script lang="ts">
  import { onMount } from 'svelte';
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

  onMount(loadToday);

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
  <p class="error-text" role="alert">Could not load today's status.</p>
{:else if today && today.decision.kind !== 'CHOICE'}
  {#if today.decision.kind === 'ACTIVE_RECOVERY'}
    <p class="status-copy">Today is an active recovery day.</p>
  {:else if today.decision.kind === 'REST'}
    <p class="status-copy">Today's a rest day.</p>
  {:else if today.plan}
    {#if today.plan.endedAt}
      <p class="status-copy">Today's workout is complete.</p>
    {:else}
      <a class="big-btn" href={`/workout/${today.plan.id}`}>Resume today's workout</a>
    {/if}
  {:else}
    <button type="button" class="big-btn" disabled={generating} onclick={generateWorkout}>
      {generating ? 'Generating…' : "Generate today's workout"}
    </button>
    {#if generateError}
      <p class="error-text" role="alert">{generateError}</p>
    {/if}
  {/if}
{/if}

<style>
  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0 0 var(--space-6);
  }

  .status-copy {
    font-size: 1.0625rem;
    margin: 0 0 var(--space-5);
  }

  .big-btn {
    display: block;
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-ui);
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--paper-raised);
    background: var(--accent-strong);
    border: none;
    border-radius: var(--radius);
    padding: var(--space-5) var(--space-4);
    text-align: center;
    text-decoration: none;
    cursor: pointer;
  }

  .big-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .error-text {
    color: var(--danger);
    font-size: 0.9375rem;
    margin-top: var(--space-3);
  }
</style>
