import { defineConfig, devices } from '@playwright/test';

// Golden path + CHOICE branch only (docs/adr/0012-test-strategy.md decision
// 4) — everything else stays at component-test level. Needs a running
// local Supabase (same as `pnpm test:rls`) plus the app's dev server; both
// GROQ_BASE_URL/OPENROUTER_BASE_URL should point somewhere unreachable in
// this environment so plan generation falls straight to the deterministic
// generator without a real network round-trip (fast, free, no live-API
// flakiness in a job that's testing UI flow, not LLM output).
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'retain-on-failure',
  },
  webServer: {
    // --host 127.0.0.1 pins the dev server to the same address this
    // config's healthcheck (url, below) polls. Without it, Vite binds
    // whatever 'localhost' resolves to first — on GitHub Actions runners
    // that's frequently the IPv6 loopback (::1) — so the server comes up
    // fine but the IPv4 healthcheck never connects and this always times
    // out, independent of how much boot time is budgeted.
    command: 'pnpm astro dev --port 4321 --host 127.0.0.1',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
