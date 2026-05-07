import { defineConfig } from 'vitest/config';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/functions/**/*.test.ts'],
    root: repoRoot,
    // Run all test files sequentially in a single worker process so they
    // share — and don't race on — the emulator state started by
    // `firebase emulators:exec`. Vitest 4 dropped poolOptions.forks.singleFork;
    // `maxWorkers: 1, isolate: false` is the documented replacement.
    maxWorkers: 1,
    isolate: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ['tests/functions/_setup.ts'],
  },
});
