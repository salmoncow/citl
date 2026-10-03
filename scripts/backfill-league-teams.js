#!/usr/bin/env node
/**
 * backfill-league-teams.js — create or update leagueTeams/{teamId} from
 * every seasons/{year}/teams doc (spec 009 AC-1, DD-5).
 *
 * Idempotent: a rerun only adds new seasons or a newer name. Never
 * overwrites captainUid and never writes seasons/**.
 *
 * Auth: gcloud Application Default Credentials. No service-account key.
 *   One-time setup: gcloud auth application-default login
 *
 * Usage:
 *   node scripts/backfill-league-teams.js --dry-run   Print team ids per season and the plan
 *   node scripts/backfill-league-teams.js             Apply the plan
 *
 * Env:
 *   FIRESTORE_EMULATOR_HOST   Run against the local emulator
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { syncLeagueTeams } from './lib/league-teams.js';

const PROJECT_ID = 'citl-baed2';
const dryRun = process.argv.includes('--dry-run');

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

const target = process.env.FIRESTORE_EMULATOR_HOST ? `emulator ${process.env.FIRESTORE_EMULATOR_HOST}` : 'PRODUCTION';
console.log(`backfill-league-teams: ${PROJECT_ID} (${target})${dryRun ? ' — dry run' : ''}`);

try {
  const { plan, idsByYear } = await syncLeagueTeams(db, { dryRun, FieldValue });
  console.log('\nTeam ids per season (same id = same league team):');
  for (const [year, ids] of [...idsByYear].sort(([a], [b]) => a - b)) {
    console.log(`  ${year}: ${ids.join(', ')}`);
  }
  console.log(`\n${plan.length === 0 ? 'No changes.' : `${dryRun ? 'Would write' : 'Wrote'} ${plan.length} league team(s):`}`);
  for (const p of plan) {
    console.log(`  ${p.create ? 'create' : 'update'} ${p.id}: ${p.data.name} [${p.data.seasons.join(', ')}]`);
  }
} catch (e) {
  console.error(`\nError: ${e.message ?? e}`);
  process.exit(1);
}
