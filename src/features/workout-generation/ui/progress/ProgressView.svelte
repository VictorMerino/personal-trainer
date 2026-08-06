<script lang="ts">
  import { authorizedFetch } from '../../../../shared/http/authorized-fetch';
  import Skeleton from '../../../../shared/ui/Skeleton.svelte';
  import type { ProgressRange } from '../../domain/progress/progress-range';
  import type { ProgressSnapshot } from '../../domain/progress/progress-snapshot';

  const ranges: ProgressRange[] = ['4w', '8w', '12w'];

  let range = $state<ProgressRange>('8w');
  let loading = $state(true);
  let loadError = $state(false);
  let snapshot = $state<ProgressSnapshot | null>(null);

  async function loadSnapshot() {
    loading = true;
    loadError = false;
    const response = await authorizedFetch(`/api/progress?range=${range}`, { method: 'GET' });
    loading = false;
    if (!response.ok) {
      loadError = true;
      return;
    }
    const body = await response.json();
    snapshot = body.snapshot as ProgressSnapshot;
  }

  function selectRange(next: ProgressRange) {
    range = next;
    loadSnapshot();
  }

  loadSnapshot();

  const adherencePercent = $derived(snapshot ? Math.round(snapshot.adherence.ratio * 100) : 0);
  const maxVolume = $derived(
    snapshot ? Math.max(1, ...Object.values(snapshot.volumePerPattern)) : 1,
  );
  const patternsWithVolume = $derived(
    snapshot
      ? Object.entries(snapshot.volumePerPattern).filter(([, sets]) => sets > 0)
      : [],
  );
</script>

<h1>Progress</h1>

<div role="group" aria-label="Range">
  {#each ranges as option (option)}
    <button type="button" class:selected={range === option} disabled={loading} onclick={() => selectRange(option)}>
      {option}
    </button>
  {/each}
</div>

{#if loading}
  <Skeleton height="12rem" label="Loading progress" />
{:else if loadError}
  <p role="alert">Could not load your progress.</p>
{:else if snapshot}
  <section aria-label="Adherence">
    <h2>Adherence</h2>
    <p>{snapshot.adherence.loggedSets} of {snapshot.adherence.prescribedSets} sets logged ({adherencePercent}%)</p>
  </section>

  <section aria-label="Volume by movement pattern">
    <h2>Volume by movement pattern</h2>
    {#if patternsWithVolume.length === 0}
      <p>No logged sets in this range yet.</p>
    {:else}
      <ul class="volume-list">
        {#each patternsWithVolume as [pattern, sets] (pattern)}
          <li>
            <span class="pattern-name">{pattern}</span>
            <span class="bar-track">
              <span class="bar-fill" style:width={`${(sets / maxVolume) * 100}%`}></span>
            </span>
            <span class="pattern-count">{sets}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  .volume-list {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .volume-list li {
    display: grid;
    grid-template-columns: 10rem 1fr 2rem;
    align-items: center;
    gap: 0.5rem;
  }

  .bar-track {
    background: #e2e8f0;
    border-radius: 0.25rem;
    height: 0.75rem;
    overflow: hidden;
  }

  .bar-fill {
    display: block;
    height: 100%;
    background: #1e40af;
  }

  button.selected {
    background: #1e40af;
    color: white;
    border-color: #1e40af;
  }
</style>
