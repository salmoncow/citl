#!/usr/bin/env node
/**
 * seed-historical-teams.js
 *
 * One-time migration: reads static JSON scorecards for 2019–2024 and writes
 * seasons/{year}/teams/{teamId} documents to Firestore.
 *
 * This fills the gap left by Phase 6's historical import, which wrote Season and
 * WeekResult documents but did NOT create team docs for pre-2025 seasons.
 * After this runs, the scorecards page will show startingAvg (W0) and rookie (R)
 * for all historical seasons.
 *
 * Prerequisites:
 *   1. Download a service account key from Firebase console:
 *      Project Settings → Service Accounts → Generate new private key
 *      Save as service-account.json in the project root (git-ignored).
 *   2. npm install (installs firebase-admin)
 *
 * Usage:
 *   node scripts/seed-historical-teams.js
 *   node scripts/seed-historical-teams.js --key-file /path/to/key.json
 *   node scripts/seed-historical-teams.js --dry-run
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const keyFileIdx = args.indexOf('--key-file');
const keyFilePath = keyFileIdx >= 0 ? args[keyFileIdx + 1] : join(ROOT, 'service-account.json');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyFilePath, 'utf8'));
} catch {
  console.error(`ERROR: could not read service account key at: ${keyFilePath}`);
  console.error('  Download from Firebase console: Project Settings → Service Accounts → Generate new private key');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const YEARS = [2019, 2020, 2021, 2022, 2023, 2024];

/** @param {string} name */
function slugify(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

let totalDocs = 0;
let totalTeams = 0;

for (const year of YEARS) {
  const jsonPath = join(ROOT, `src/data/scorecards/${year}.json`);
  let seasonData;
  try {
    seasonData = JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch {
    console.error(`  SKIP ${year}: could not read ${jsonPath}`);
    continue;
  }

  const teams = seasonData.teams ?? [];
  console.log(`\n${year}: ${teams.length} teams`);

  for (const team of teams) {
    const teamId = slugify(team.name);
    const shooters = (team.shooters ?? []).map((s) => ({
      name: s.name,
      rookie: s.rookie ?? false,
      startingAvg: s.startingAvg ?? 35,
    }));

    const doc = {
      name: team.name,
      captain: '',
      shooters,
    };

    const ref = db.collection('seasons').doc(String(year)).collection('teams').doc(teamId);

    if (dryRun) {
      console.log(`  [DRY RUN] would write seasons/${year}/teams/${teamId}`, JSON.stringify(doc).slice(0, 80) + '…');
    } else {
      await ref.set(doc, { merge: false });
      console.log(`  ✓ seasons/${year}/teams/${teamId} (${shooters.length} shooters)`);
      totalDocs++;
    }
    totalTeams++;
  }
}

if (dryRun) {
  console.log(`\n[DRY RUN] Would write ${totalTeams} team documents across ${YEARS.length} seasons.`);
} else {
  console.log(`\nDone. Wrote ${totalDocs} team documents across ${YEARS.length} seasons.`);
}
process.exit(0);
