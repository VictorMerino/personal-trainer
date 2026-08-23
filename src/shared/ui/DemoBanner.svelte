<script lang="ts">
  import { onMount } from 'svelte';
  import { getCurrentUserId } from '../supabase/browser-client';

  let isDemo = $state(false);

  onMount(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const demoIds = (import.meta.env.PUBLIC_DEMO_USER_IDS ?? '')
      .split(',')
      .map((id: string) => id.trim())
      .filter(Boolean);
    isDemo = demoIds.includes(userId);
  });
</script>

{#if isDemo}
  <p class="demo-banner" role="status">
    Demo account — plans are generated without AI and limited to a few per
    day. Data may be reset at any time.
  </p>
{/if}

<style>
  .demo-banner {
    margin: 0 0 var(--space-5);
    padding: var(--space-3) var(--space-4);
    background: var(--accent-soft);
    color: var(--ink);
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 600;
    text-align: center;
  }
</style>
