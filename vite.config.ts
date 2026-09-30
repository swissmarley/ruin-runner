import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    // Lets the long-run memory test force GC for stable heap measurements.
    execArgv: ['--expose-gc'],
    testTimeout: 120_000,
  },
});
