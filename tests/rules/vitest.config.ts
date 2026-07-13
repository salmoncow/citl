import { defineConfig } from 'vitest/config';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..');

export default defineConfig({
  resolve: {
    // Mirror the root vitest.config.ts '@' alias: repository-cascades
    // imports src/ modules whose value imports (e.g. @/types/result)
    // must resolve at runtime, not just in the type checker.
    alias: {
      '@': path.resolve(repoRoot, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    root: repoRoot,
    // Rules tests run sequentially in a shared emulator; isolate to avoid
    // cross-test interference at the doc level. Vitest 4 dropped
    // poolOptions.forks.singleFork; `maxWorkers: 1, isolate: false` is the
    // documented replacement.
    maxWorkers: 1,
    isolate: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
