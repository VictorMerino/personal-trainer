<script lang="ts">
  import { getProgress } from '../api-client';
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
    try {
      const result = await getProgress(range);
      loading = false;
      if (!result.ok) {
        loadError = true;
        return;
      }
      snapshot = result.value.snapshot;
    } catch (err) {
      console.error('[progress] failed to load snapshot', err);
      loading = false;
      loadError = true;
    }
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

<div class="chip-row" role="group" aria-label="Range">
  {#each ranges as option (option)}
    <button
      type="button"
      class="chip"
      class:selected={range === option}
      disabled={loading}
      onclick={() => selectRange(option)}
    >
      {option}
    </button>
  {/each}
</div>

{#if loading}
  <Skeleton height="12rem" label="Loading progress" />
{:else if loadError}
  <p class="error-text" role="alert">Could not load your progress.</p>
{:else if snapshot}
  <section class="block" aria-label="Adherence">
    <h2>Adherence</h2>
    <p class="stat-line">
      {snapshot.adherence.loggedSets} of {snapshot.adherence.prescribedSets} sets logged ({adherencePercent}%)
    </p>
  </section>

  <section class="block" aria-label="Volume by movement pattern">
    <h2>Volume by movement pattern</h2>
    {#if patternsWithVolume.length === 0}
      <p class="empty-copy">No logged sets in this range yet.</p>
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
  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0 0 var(--space-5);
  }

  h2 {
    font-size: 1.0625rem;
    font-weight: 700;
    margin: 0 0 var(--space-3);
  }

  .chip-row {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-6);
  }

  .chip {
    font-family: var(--font-data);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--ink);
    background: var(--paper-raised);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: var(--space-2) var(--space-4);
    cursor: pointer;
  }

  .chip.selected {
    background: var(--accent);
    color: var(--paper-raised);
    border-color: var(--accent);
  }

  .chip:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .block {
    margin-bottom: var(--space-6);
  }

  .stat-line {
    font-family: var(--font-data);
    font-variant-numeric: tabular-nums;
    font-size: 1.0625rem;
    color: var(--ink);
    margin: 0;
  }

  .empty-copy {
    color: var(--ink-soft);
    font-size: 0.9375rem;
  }

  .volume-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .volume-list li {
    display: grid;
    grid-template-columns: 8rem 1fr 2.5rem;
    align-items: center;
    gap: var(--space-3);
  }

  .pattern-name {
    font-size: 0.875rem;
    text-transform: capitalize;
  }

  .pattern-count {
    font-family: var(--font-data);
    font-variant-numeric: tabular-nums;
    font-size: 0.875rem;
    color: var(--ink-soft);
    text-align: right;
  }

  .bar-track {
    background: var(--line-soft);
    border-radius: 3px;
    height: 8px;
    overflow: hidden;
  }

  .bar-fill {
    display: block;
    height: 100%;
    background: var(--accent);
  }

  .error-text {
    color: var(--danger);
    font-size: 0.9375rem;
  }
</style>
