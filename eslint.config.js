// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import sonarjs from 'eslint-plugin-sonarjs';
import boundaries from 'eslint-plugin-boundaries';

const boundariesElements = [
  { type: 'domain', pattern: 'src/features/*/domain/**' },
  { type: 'application', pattern: 'src/features/*/application/**' },
  { type: 'infrastructure', pattern: 'src/features/*/infrastructure/**' },
  { type: 'ui', pattern: 'src/features/*/ui/**' },
  { type: 'shared', pattern: 'src/shared/**' },
  { type: 'pages', pattern: 'src/pages/**' },
];

export default tseslint.config(
  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  { ...sonarjs.configs.recommended },
  {
    settings: {
      'boundaries/elements': boundariesElements,
    },
    plugins: { boundaries },
    rules: {
      // Dependency rule (docs/PROJECT-BRIEF.md §4): all dependencies point inwards.
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'domain', allow: [] },
            { from: 'application', allow: ['domain'] },
            { from: 'infrastructure', allow: ['domain'] },
            { from: 'ui', allow: ['domain', 'shared'] },
            { from: 'shared', allow: ['shared'] },
            { from: 'pages', allow: ['domain', 'application', 'infrastructure', 'ui', 'shared'] },
          ],
        },
      ],
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-nested-conditional': 'error',
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**'],
    rules: {
      'sonarjs/no-duplicate-string': 'off',
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    // Standalone Node scripts (e.g. manual fixture capture) — not part of
    // the app bundle, so they run under plain Node globals, not DOM/Astro's.
    files: ['scripts/**'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', fetch: 'readonly' },
    },
  }
);
