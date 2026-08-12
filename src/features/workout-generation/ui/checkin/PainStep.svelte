<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';
  import type { BodyZone } from '../../domain/exercise/exercise.schema';
  import type { PainLevel, PainReport } from '../../domain/readiness/daily-checkin.schema';

  interface Props {
    oncomplete: (painReports: PainReport[]) => void;
  }

  const { oncomplete }: Props = $props();

  const zones: BodyZone[] = ['knee', 'hip', 'lower-back', 'shoulder', 'elbow', 'wrist', 'ankle', 'neck'];
  const levels: Exclude<PainLevel, 'none'>[] = ['mild', 'moderate', 'severe'];

  let mode = $state<'ask' | 'zones'>('ask');
  const zoneLevels = new SvelteMap<BodyZone, PainLevel | null>();

  function toggleZone(zone: BodyZone) {
    if (zoneLevels.has(zone)) zoneLevels.delete(zone);
    else zoneLevels.set(zone, null);
  }

  function setLevel(zone: BodyZone, level: PainLevel) {
    zoneLevels.set(zone, level);
  }

  const allZonesHaveLevels = $derived(
    zoneLevels.size > 0 && [...zoneLevels.values()].every((level) => level !== null),
  );

  function submitZones() {
    const painReports: PainReport[] = [...zoneLevels.entries()].map(([zone, level]) => ({
      zone,
      level: level as PainLevel,
    }));
    oncomplete(painReports);
  }
</script>

{#if mode === 'ask'}
  <div class="stack" role="group" aria-label="Pain today">
    <button type="button" class="big-btn" onclick={() => oncomplete([])}>No pain today</button>
    <button type="button" class="big-btn secondary" onclick={() => (mode = 'zones')}>I have pain</button>
  </div>
{:else}
  <div class="chip-row" role="group" aria-label="Which zones hurt">
    {#each zones as zone (zone)}
      <button type="button" class="chip" class:selected={zoneLevels.has(zone)} onclick={() => toggleZone(zone)}>
        {zone}
      </button>
    {/each}
  </div>

  {#each [...zoneLevels.keys()] as zone (zone)}
    <div class="zone-levels">
      <p class="zone-label">{zone}</p>
      <div class="chip-row" role="group" aria-label={`${zone} pain level`}>
        {#each levels as level (level)}
          <button
            type="button"
            class="chip"
            class:selected={zoneLevels.get(zone) === level}
            onclick={() => setLevel(zone, level)}
          >
            {level}
          </button>
        {/each}
      </div>
    </div>
  {/each}

  <button type="button" class="big-btn" disabled={!allZonesHaveLevels} onclick={submitZones}>Continue</button>
{/if}

<style>
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

  .big-btn.secondary {
    background: transparent;
    color: var(--ink);
    border: 1.5px solid var(--line);
  }

  .big-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }

  .chip {
    font-family: var(--font-ui);
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--ink);
    background: var(--paper-raised);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: var(--space-2) var(--space-4);
    cursor: pointer;
    text-transform: capitalize;
  }

  .chip.selected {
    background: var(--accent);
    color: var(--paper-raised);
    border-color: var(--accent);
  }

  .zone-levels {
    margin-bottom: var(--space-4);
  }

  .zone-label {
    font-family: var(--font-data);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-soft);
    margin: 0 0 var(--space-2);
  }
</style>
