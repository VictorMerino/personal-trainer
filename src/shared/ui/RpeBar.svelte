<script lang="ts">
  interface Props {
    mode: 'input' | 'display';
    value?: number | null;
    onchange?: (value: number) => void;
  }

  const { mode, value = null, onchange }: Props = $props();

  const scale = Array.from({ length: 10 }, (_, i) => i + 1);

  function select(rpe: number) {
    if (mode !== 'input') return;
    onchange?.(rpe);
  }
</script>

<div class="rpe-bar" role="group" aria-label="RPE (rate of perceived exertion)">
  {#each scale as rpe (rpe)}
    <button
      type="button"
      class="rpe-cell"
      class:selected={value === rpe}
      disabled={mode === 'display'}
      aria-pressed={value === rpe}
      onclick={() => select(rpe)}
    >
      {rpe}
    </button>
  {/each}
</div>

<style>
  .rpe-bar {
    display: flex;
    gap: var(--space-1);
  }

  .rpe-cell {
    flex: 1;
    padding: var(--space-2) 0;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--paper-raised);
    color: var(--ink);
    font-family: var(--font-data);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .rpe-cell:disabled {
    opacity: 0.6;
  }

  .rpe-cell.selected {
    background: var(--accent);
    color: var(--paper-raised);
    border-color: var(--accent);
  }
</style>
