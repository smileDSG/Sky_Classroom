import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Vendored/generated code:
    'packages/**',
    'software-cup-A3/**',
    // Claude Code local files:
    '.agents/**',
    '.claude/**',
    '.codex/**',
    '.gstack/**',
    '.mimocode/**',
    '.superpowers/**',
    '.worktrees/**',
    // Local caches and runtime data:
    '.pnpm-store/**',
    'logs/**',
    'memory/**',
    'tmp/**',
    // Playwright e2e tests (not React code):
    'e2e/**',
    // Temporary project copies (e.g. deeptutor, worktrees):
    '.tmp-deeptutor/**',
  ]),
  {
    rules: {
      // Dynamic AI-generated image URLs from various providers are incompatible
      // with next/image (requires known dimensions and whitelisted domains).
      '@next/next/no-img-element': 'off',
      // Allow unused vars/args prefixed with _ (common convention for intentionally
      // unused destructured values, callback params, etc.)
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // Legacy code still contains a fair amount of loose typing and older React
      // patterns. Keep these visible, but don't make lint unusable while they are
      // being paid down incrementally.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      'prefer-const': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
    },
  },
  {
    files: ['tests/**/*.{ts,tsx,js,jsx}'],
    rules: {
      // Tests often use deliberately loose doubles and fixtures. Keep strict
      // production code rules, but don't let test scaffolding drown lint signal.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);

export default eslintConfig;
