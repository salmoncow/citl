#!/usr/bin/env node
/**
 * migrate-entries.js
 *
 * One-time script: migrates citl:entry:* entries from a localStorage JSON export
 * to Firestore seasons/{year}/entries/{weekNumber}_{teamId}.
 *
 * How to export localStorage entries from the browser:
 *   1. Open the admin panel in Chrome/Firefox.
 *   2. Open DevTools → Console.
 *   3. Run the following and copy the output to a file (e.g. entries-export.json):
 *
 *      const out = {};
 *      for (let i = 0; i < localStorage.length; i++) {
 *        const k = localStorage.key(i);
 *        if (k?.startsWith('citl:entry:')) out[k] = JSON.parse(localStorage.getItem(k));
 *      }
 *      console.log(JSON.stringify(out, null, 2));
 *
 * Prerequisites:
 *   1. Firestore must be enabled. Copy .env.example → .env with credentials.
 *   2. Your Firebase account must have admin write access (custom claim admin: true).
 *
 * Usage:
 *   node scripts/migrate-entries.js --input entries-export.json [--dry-run]
 *
 * Options:
 *   --input <path>   Path to the JSON export file (required)
 *   --dry-run        Print what would be written without writing to Firestore
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const inputIdx = args.indexOf('--input');
const inputPath = inputIdx >= 0 ? args[inputIdx + 1] : null;
const dryRun = args.includes('--dry-run');

if (!inputPath) {
  console.error('ERROR: --input <path> is required.');
  console.error('Usage: node scripts/migrate-entries.js --input entries-export.json [--dry-run]');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load .env manually (no dotenv dependency)
// ---------------------------------------------------------------------------

function loadEnv(envPath) {
  let raw;
  try { raw = readFileSync(envPath, 'utf8'); } catch { return {}; }
  const env = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
  return env;
}

const env = loadEnv(join(ROOT, '.env'));

const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY,
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error('ERROR: VITE_FIREBASE_PROJECT_ID not set. Copy .env.example → .env and fill in values.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load export file
// ---------------------------------------------------------------------------

let exportData;
try {
  exportData = JSON.parse(readFileSync(inputPath, 'utf8'));
} catch (err) {
  console.error(`ERROR: could not read ${inputPath}: ${err.message}`);
  process.exit(1);
}

// Support two formats:
//   1. { "citl:entry:2025:1:team-slug": { year, weekNumber, teamId, ... }, ... }  (object keyed by LS key)
//   2. [ { year, weekNumber, teamId, ... }, ... ]  (plain array)
const entries = Array.isArray(exportData)
  ? exportData
  : Object.values(exportData);

if (entries.length === 0) {
  console.log('No entries found in export file. Nothing to migrate.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Validate entries
// ---------------------------------------------------------------------------

const slugify = (name) => name.trim().toLowerCase().replace(/\s+/g, '-');

const valid = [];
for (const entry of entries) {
  if (!entry || typeof entry !== 'object') continue;
  if (!entry.year || !entry.weekNumber || !entry.teamName) {
    console.warn('Skipping invalid entry (missing year/weekNumber/teamName):', JSON.stringify(entry));
    continue;
  }
  // Normalize teamId (may be missing in older localStorage entries)
  if (!entry.teamId) entry.teamId = slugify(entry.teamName);
  valid.push(entry);
}

console.log(`Found ${valid.length} valid entries to migrate.`);

// ---------------------------------------------------------------------------
// Migrate
// ---------------------------------------------------------------------------

if (!dryRun) {
  var app = initializeApp(firebaseConfig);
  var db = getFirestore(app);
}

let written = 0;
let skipped = 0;

for (const entry of valid) {
  const entryId = `${entry.weekNumber}_${entry.teamId}`;
  const docPath = `seasons/${entry.year}/entries/${entryId}`;

  const docData = {
    year:       entry.year,
    weekNumber: entry.weekNumber,
    teamId:     entry.teamId,
    teamName:   entry.teamName,
    savedAt:    entry.savedAt ?? new Date().toISOString(),
    shooters:   entry.shooters ?? [],
  };

  if (dryRun) {
    console.log(`[dry-run] ${docPath}:`, JSON.stringify(docData));
    continue;
  }

  try {
    await setDoc(doc(db, 'seasons', String(entry.year), 'entries', entryId), docData);
    console.log(`  ✓ ${docPath}`);
    written++;
  } catch (err) {
    console.error(`  ✗ ${docPath}: ${err.message}`);
    skipped++;
  }
}

if (dryRun) {
  console.log(`\n[dry-run] Would migrate ${valid.length} entries. No writes performed.`);
} else {
  console.log(`\nDone. ${written} written, ${skipped} failed.`);
  process.exit(skipped > 0 ? 1 : 0);
}
