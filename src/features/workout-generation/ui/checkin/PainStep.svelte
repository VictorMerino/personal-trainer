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
  <div role="group" aria-label="Pain today">
    <button type="button" onclick={() => oncomplete([])}>No pain today</button>
    <button type="button" onclick={() => (mode = 'zones')}>I have pain</button>
  </div>
{:else}
  <div role="group" aria-label="Which zones hurt">
    {#each zones as zone (zone)}
      <button type="button" class:selected={zoneLevels.has(zone)} onclick={() => toggleZone(zone)}>
        {zone}
      </button>
    {/each}
  </div>

  {#each [...zoneLevels.keys()] as zone (zone)}
    <div role="group" aria-label={`${zone} pain level`}>
      {#each levels as level (level)}
        <button type="button" class:selected={zoneLevels.get(zone) === level} onclick={() => setLevel(zone, level)}>
          {level}
        </button>
      {/each}
    </div>
  {/each}

  <button type="button" disabled={!allZonesHaveLevels} onclick={submitZones}>Continue</button>
{/if}
