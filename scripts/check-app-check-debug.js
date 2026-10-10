#!/usr/bin/env node
/**
 * App Check debug-token guard.
 *
 * A debug token compiled into a bundle is public: anyone who loads the
 * page can read it and mint App Check tokens for production (citl-baed2),
 * which defeats App Check on Firestore, Auth, and every callable. Every
 * workflow in this repo deploys to that project, so none may inject one.
 *
 * Fails when:
 *   1. any .github/workflows file references an App Check debug-token
 *      variable, or
 *   2. dist/ exists and a built file contains the debug-token branch of
 *      src/infrastructure/appcheck.ts (its console marker). That branch is
 *      gated on import.meta.env.DEV, so `vite build` should always drop it,
 *      or a built file contains the whole import.meta.env object. Vite
 *      inlines it when code reads `import.meta.env['X']` (bracket access),
 *      shipping every VITE_* value in the build environment.
 *
 * Run directly (node scripts/check-app-check-debug.js); wired into the
 * hosting predeploy hook in firebase.json and the CI build job.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOW_DIR = '.github/workflows';
const DEBUG_VAR = /APP_?CHECK_DEBUG_TOKEN/i;
// Must match the console.warn text in src/infrastructure/appcheck.ts.
const BUNDLE_MARKER = 'DEBUG TOKEN MODE';
const INLINED_ENV = /\{BASE_URL:"/;

const failures = [];

for (const name of readdirSync(WORKFLOW_DIR)) {
  if (!/\.ya?ml$/.test(name)) continue;
  const file = join(WORKFLOW_DIR, name);
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (DEBUG_VAR.test(line)) failures.push(`${file}:${i + 1}: references an App Check debug token`);
    });
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

if (existsSync('dist')) {
  for (const file of walk('dist').filter((f) => /\.(js|html)$/.test(f))) {
    const text = readFileSync(file, 'utf8');
    if (text.includes(BUNDLE_MARKER)) {
      failures.push(`${file}: build contains the App Check debug-token branch`);
    }
    if (INLINED_ENV.test(text)) {
      failures.push(`${file}: build inlines the whole import.meta.env object (use dot access)`);
    }
  }
}

if (failures.length) {
  console.error('App Check debug-token guard failed:');
  for (const f of failures) console.error(`  ${f}`);
  console.error('Debug tokens are for the local dev server only; see src/infrastructure/appcheck.ts.');
  process.exit(1);
}
console.log('App Check debug-token guard: OK');
