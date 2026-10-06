import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/**/*.e2e.test.ts', 'tests/**/e2e-*.test.ts', 'tests/**/*.eval.test.ts'],
    setupFiles: ['tests/setup-env.ts', 'tests/setup-vitest.ts'],
    environment: 'jsdom',
    globals: true,
  },
});
