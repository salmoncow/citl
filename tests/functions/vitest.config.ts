import { defineConfig } from 'vitest/config';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/functions/**/*.test.ts'],
    root: repoRoot,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ['tests/functions/_setup.ts'],
  },
});
