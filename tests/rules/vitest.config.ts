import { defineConfig } from 'vitest/config';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    root: repoRoot,
    // Rules tests run sequentially in a shared emulator; isolate to avoid
    // cross-test interference at the doc level.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
