import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup/env.ts', 'tests/setup/db.ts'],
    poolOptions: {
      threads: { singleThread: true },
    },
    hookTimeout: 120_000,
    testTimeout: 60_000,
  },
});
