#!/usr/bin/env node
/**
 * Writes .firebase-preview.json: firebase.json's hosting block retargeted
 * at the `citl-preview` Hosting site, and nothing else (no Firestore,
 * no Functions), so a preview deploy can only touch that site.
 *
 * Why a separate site: its hostname, citl-preview.web.app, is fixed, so
 * it sits on the production reCAPTCHA Enterprise key's allowed-domains
 * list and previews mint real App Check tokens. Preview channels
 * (citl-baed2--<channel>-<hash>.web.app) cannot be allowlisted.
 *
 * Deriving the config keeps one source of truth for headers, CSP, and
 * rewrites. Preview-only additions:
 *   - `X-Robots-Tag: noindex, nofollow` on every response, so search
 *     engines never list the preview in place of citl.club;
 *   - a refusal to deploy unless dist/ contains the preview bar
 *     (src/components/preview-bar.ts, built with VITE_PREVIEW_SITE=true),
 *     so every preview tells visitors the official site is citl.club. Used by `npm run deploy:preview:site` (locally and in
 * .github/workflows/deploy-preview.yml).
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PREVIEW_SITE = 'citl-preview';
// Must match PREVIEW_MARKER in src/components/preview-bar.ts.
const PREVIEW_MARKER = 'citl-preview-build';

const jsDir = 'dist/assets/js';
const hasBar = readdirSync(jsDir).some(
  (f) => f.endsWith('.js') && readFileSync(join(jsDir, f), 'utf8').includes(PREVIEW_MARKER),
);
if (!hasBar) {
  console.error('dist/ has no preview bar. Build with VITE_PREVIEW_SITE=true (npm run deploy:preview).');
  process.exit(1);
}

const { hosting } = JSON.parse(readFileSync('firebase.json', 'utf8'));
const config = {
  hosting: {
    ...hosting,
    site: PREVIEW_SITE,
    headers: [
      ...hosting.headers,
      { source: '**', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ],
  },
};
writeFileSync('.firebase-preview.json', `${JSON.stringify(config, null, 2)}\n`);
console.log(`Wrote .firebase-preview.json (hosting site: ${PREVIEW_SITE})`);
