#!/usr/bin/env node
/**
 * CSP inline-script hash guard.
 *
 * firebase.json's Content-Security-Policy pins the sha256 of the single
 * inline <script> in src/index.html (the pre-paint theme snippet). Any
 * edit to that snippet — even whitespace — changes the hash, and a stale
 * pin would make production browsers silently block the script. This
 * check fails the build/deploy loudly on mismatch.
 *
 * Run directly (node scripts/check-csp-hash.js); wired into the hosting
 * predeploy hook in firebase.json and the CI build job.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const csp = JSON.parse(readFileSync('firebase.json', 'utf8'))
  .hosting.headers.flatMap((h) => h.headers)
  .find((h) => h.key === 'Content-Security-Policy').value;
const pins = [...csp.matchAll(/'sha256-([^']+)'/g)].map((m) => m[1]);

let failed = false;
for (const file of ['src/index.html', 'dist/index.html']) {
  if (!existsSync(file)) continue; // dist/ only exists after a build
  const inlineScripts = [
    ...readFileSync(file, 'utf8').matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
  ];
  for (const [, body] of inlineScripts) {
    const hash = createHash('sha256').update(body).digest('base64');
    if (!pins.includes(hash)) {
      console.error(
        `✗ ${file}: inline script hash 'sha256-${hash}' is not pinned in ` +
          `firebase.json script-src (pinned: ${pins.map((p) => `'sha256-${p}'`).join(', ') || 'none'})`
      );
      failed = true;
    }
  }
}

if (failed) {
  console.error('Update the CSP pin in firebase.json to match src/index.html (see the comment above the inline script).');
  process.exit(1);
}
console.log('✓ CSP inline-script hash pin matches index.html');
