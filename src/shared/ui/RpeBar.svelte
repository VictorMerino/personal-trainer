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
    gap: 0.25rem;
  }

  .rpe-cell {
    flex: 1;
    padding: 0.5rem 0;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    background: white;
    font-weight: 600;
  }

  .rpe-cell:disabled {
    opacity: 0.6;
  }

  .rpe-cell.selected {
    background: #1e40af;
    color: white;
    border-color: #1e40af;
  }
</style>
