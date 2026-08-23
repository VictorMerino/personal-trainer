<script lang="ts">
  import { onMount } from 'svelte';
  import { getTodayStatus } from '../../../features/workout-generation/ui/api-client';

  interface Props {
    active: 'home' | 'progress';
  }

  const { active }: Props = $props();

  // null = no check-in yet today (getTodayStatus 404s) or still loading —
  // badge stays empty either way, never triggers navigation from here.
  let todayResolved = $state<boolean | null>(null);

  onMount(async () => {
    const result = await getTodayStatus();
    if (!result.ok) {
      todayResolved = false;
      return;
    }

    const { decision, plan } = result.value;
    todayResolved =
      decision.kind === 'REST' || decision.kind === 'ACTIVE_RECOVERY' || Boolean(plan?.endedAt);
  });
</script>

<nav class="bottom-nav" aria-label="Main">
  <a href="/app" class="tab" class:selected={active === 'home'} aria-current={active === 'home' ? 'page' : undefined}>
    <span class="tab-label">
      Home
      {#if todayResolved}
        <span class="badge" aria-label="Today's plan resolved">✓</span>
      {/if}
    </span>
  </a>
  <a
    href="/progress"
    class="tab"
    class:selected={active === 'progress'}
    aria-current={active === 'progress' ? 'page' : undefined}
  >
    <span class="tab-label">Progress</span>
  </a>
</nav>

<style>
  .bottom-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    max-width: 480px;
    margin: 0 auto;
    background: var(--paper-raised);
    border-top: 1px solid var(--line);
    padding-bottom: env(safe-area-inset-bottom, 0);
  }

  .tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-3) var(--space-2);
    color: var(--ink-soft);
    font-size: 0.9375rem;
    font-weight: 600;
    text-decoration: none;
  }

  .tab.selected {
    color: var(--accent);
  }

  .tab-label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.125rem;
    height: 1.125rem;
    border-radius: 50%;
    background: var(--success-soft);
    color: var(--success);
    font-size: 0.6875rem;
    line-height: 1;
  }
</style>
