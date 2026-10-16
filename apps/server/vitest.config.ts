import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Test against the contract's TypeScript source, so no prior build is needed.
    alias: {
      '@competitor-pulse/contract': fileURLToPath(
        new URL('../../packages/contract/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    globalSetup: ['./src/test/global-setup.ts'],
    // Integration tests share one Postgres container and truncate between tests.
    fileParallelism: false,
    hookTimeout: 120_000,
  },
});
