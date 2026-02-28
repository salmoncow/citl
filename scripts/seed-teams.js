#!/usr/bin/env node
/**
 * seed-teams.js
 *
 * One-time script: reads src/data/teams/teams.json and writes each team as a
 * document to seasons/{year}/teams/{teamId} in Firestore.
 *
 * Uses the Firebase Admin SDK (bypasses security rules — safe for server scripts).
 *
 * Prerequisites:
 *   1. Firestore must be enabled in the Firebase console.
 *   2. Download a service account key from Firebase console:
 *      Project Settings → Service Accounts → Generate new private key
 *      Save as service-account.json in the project root (git-ignored).
 *   3. npm install (installs firebase-admin)
 *
 * Usage:
 *   node scripts/seed-teams.js [--year 2025] [--dry-run] [--key-file /path/to/key.json]
 *
 * Options:
 *   --year <year>          Only seed teams for this year (default: all years in teams.json)
 *   --dry-run              Print what would be written without writing to Firestore
 *   --key-file <path>      Path to service account key (default: ./service-account.json)
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const yearArg = args.includes('--year') ? parseInt(args[args.indexOf('--year') + 1], 10) : null;
const dryRun = args.includes('--dry-run');
const keyFileIdx = args.indexOf('--key-file');
const keyFilePath = keyFileIdx >= 0 ? args[keyFileIdx + 1] : join(ROOT, 'service-account.json');

// ---------------------------------------------------------------------------
// Load service account key
// ---------------------------------------------------------------------------

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyFilePath, 'utf8'));
} catch (err) {
  console.error(`ERROR: could not read service account key at: ${keyFilePath}`);
  console.error('  Download from Firebase console: Project Settings → Service Accounts → Generate new private key');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load teams.json
// ---------------------------------------------------------------------------

const teamsPath = join(ROOT, 'src', 'data', 'teams', 'teams.json');
let teamsData;
try {
  teamsData = JSON.parse(readFileSync(teamsPath, 'utf8'));
} catch (err) {
  console.error(`ERROR: could not read ${teamsPath}: ${err.message}`);
  process.exit(1);
}

const seasons = teamsData.seasons ?? {};
const years = yearArg ? [String(yearArg)] : Object.keys(seasons);

if (years.length === 0) {
  console.error('ERROR: no season years found in teams.json');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

if (!dryRun) {
  initializeApp({ credential: cert(serviceAccount) });
  var db = getFirestore();
}

let totalWritten = 0;

for (const year of years) {
  const teams = seasons[year];
  if (!Array.isArray(teams)) {
    console.warn(`Warning: no teams array for year ${year}, skipping.`);
    continue;
  }

  console.log(`\nYear ${year}: ${teams.length} teams`);

  for (const team of teams) {
    const docData = {
      name:     team.name,
      captain:  null,
      shooters: team.shooters.map((s) => ({
        name:        s.name,
        rookie:      s.rookie ?? false,
        startingAvg: s.startingAvg ?? 35,
      })),
    };

    if (dryRun) {
      console.log(`  [dry-run] seasons/${year}/teams/${team.id}:`, JSON.stringify(docData));
    } else {
      try {
        await db.collection('seasons').doc(String(year)).collection('teams').doc(team.id).set(docData);
        console.log(`  ✓ seasons/${year}/teams/${team.id}`);
        totalWritten++;
      } catch (err) {
        console.error(`  ✗ seasons/${year}/teams/${team.id}: ${err.message}`);
      }
    }
  }
}

if (dryRun) {
  console.log('\n[dry-run] No writes performed.');
} else {
  console.log(`\nDone. ${totalWritten} documents written.`);
  process.exit(0);
}
