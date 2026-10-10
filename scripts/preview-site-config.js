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
 * rewrites. Used by `npm run deploy:preview:site` (locally and in
 * .github/workflows/deploy-preview.yml).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PREVIEW_SITE = 'citl-preview';

const { hosting } = JSON.parse(readFileSync('firebase.json', 'utf8'));
const config = { hosting: { ...hosting, site: PREVIEW_SITE } };
writeFileSync('.firebase-preview.json', `${JSON.stringify(config, null, 2)}\n`);
console.log(`Wrote .firebase-preview.json (hosting site: ${PREVIEW_SITE})`);
