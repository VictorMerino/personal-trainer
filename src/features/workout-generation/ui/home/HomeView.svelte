<script lang="ts">
  import { authorizedFetch } from '../../../../shared/http/authorized-fetch';
  import Skeleton from '../../../../shared/ui/Skeleton.svelte';
  import type { TrainingDecision } from '../../domain/readiness/training-decision';

  interface TodayStatus {
    checkInId: string;
    decision: TrainingDecision;
    plan: { id: string; endedAt: string | null } | null;
  }

  let loading = $state(true);
  let today = $state<TodayStatus | null>(null);
  let loadError = $state(false);
  let generating = $state(false);
  let generateError = $state<string | null>(null);

  async function loadToday() {
    const response = await authorizedFetch('/api/checkin', { method: 'GET' });
    loading = false;

    if (response.status === 404) {
      window.location.href = '/checkin';
      return;
    }
    if (!response.ok) {
      loadError = true;
      return;
    }

    const body = (await response.json()) as TodayStatus;
    today = body;

    if (body.decision.kind === 'CHOICE') {
      window.location.href = `/checkin/${body.checkInId}/choice`;
    }
  }

  loadToday();

  async function generateWorkout() {
    generating = true;
    generateError = null;

    const response = await authorizedFetch('/api/workouts/generate', { method: 'POST' });
    if (!response.ok) {
      generating = false;
      generateError = 'Could not generate a workout. Please try again.';
      return;
    }
    const body = await response.json();
    window.location.href = `/workout/${body.id}`;
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
