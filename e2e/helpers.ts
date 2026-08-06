import type { Page } from '@playwright/test';

// Every page in this app is a single Astro `client:load` Svelte island.
// Interacting with the server-rendered markup before hydration attaches
// gets any typed/clicked state wiped when Svelte mounts over it — wait for
// the network (including the hydration script) to go quiet first.
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}
