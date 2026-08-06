import { defineConfig } from 'vitest/config';

// Separate from vitest.config.ts on purpose: these tests need a live local
// Supabase instance (`supabase start`), unlike every other suite in this
// repo, so they're never part of the default `pnpm test` run.
export default defineConfig({
  test: {
    include: ['tests/rls/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
