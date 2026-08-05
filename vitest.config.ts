import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
  },
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/infrastructure/**', '**/*.d.ts', '**/types.ts', 'src/pages/**'],
      thresholds: {
        'src/features/*/domain/**': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/shared/utils/**': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/features/*/application/**': { statements: 80, branches: 80, functions: 80, lines: 80 },
      },
    },
  },
});
