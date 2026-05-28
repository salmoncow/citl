#!/usr/bin/env node
/**
 * seed-emulator.js — Populate the local Firebase emulator with realistic
 * scorecard / standings / announcement data for SPA development.
 *
 * Refuses to run unless FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST
 * are set — this script must never touch production. Use the npm wrappers
 * (`npm run seed:emulator`) which set those env vars for you.
 *
 * Auth: gcloud Application Default Credentials. No service-account key.
 *   One-time setup: gcloud auth application-default login
 *
 * Usage:
 *   node scripts/seed-emulator.js seed       Clear + write fresh seed (default)
 *   node scripts/seed-emulator.js clear      Wipe seeded collections only
 *   node scripts/seed-emulator.js status     Print doc counts per collection
 */

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

import {
  ACTIVE_YEAR,
  COMPLETE_YEAR,
  WEEKS_PER_SEASON,
  ACTIVE_WEEKS_PUBLISHED,
  TEST_USERS,
  ANNOUNCEMENTS,
  BANNER_MESSAGE,
  buildTeam,
  buildWeekResult,
  buildEntry,
  buildSeason,
  buildAwards,
} from './fixtures/seed-data.js';

const PROJECT_ID = 'citl-baed2';

const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST;
if (!AUTH_HOST || !FS_HOST) {
  console.error('Refusing to run: FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST must be set.');
  console.error('Use `npm run seed:emulator` (the npm wrapper sets these for you).');
  process.exit(1);
}

initializeApp({ projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

const SEEDED_COLLECTIONS = ['users', 'audit', 'announcements', 'config', 'seasons'];

function usage(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error(`Usage:
  node scripts/seed-emulator.js seed     Clear + write fresh seed (default)
  node scripts/seed-emulator.js clear    Wipe seeded collections only
  node scripts/seed-emulator.js status   Print doc counts per collection

Env (set automatically by \`npm run seed:emulator\`):
  FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
  GCLOUD_PROJECT=citl-baed2

One-time setup: gcloud auth application-default login`);
  process.exit(1);
}

function header(title) {
  console.log(`─── seed-emulator: ${title} ${'─'.repeat(Math.max(0, 32 - title.length))}`);
  console.log(`project   : ${PROJECT_ID} (emulator)`);
  console.log(`auth host : ${AUTH_HOST}`);
  console.log(`fs host   : ${FS_HOST}`);
  console.log('───────────────────────────────────────────────────');
}

// ── Clear ───────────────────────────────────────────────────────────────────

async function clearSeededFirestore() {
  for (const col of SEEDED_COLLECTIONS) {
    await db.recursiveDelete(db.collection(col));
  }
}

async function clearSeededAuthUsers() {
  for (const u of TEST_USERS) {
    try {
      await auth.deleteUser(u.uid);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
    }
  }
}

async function clearCommand({ quiet = false } = {}) {
  if (!quiet) header('clear');
  await clearSeededFirestore();
  await clearSeededAuthUsers();
  if (!quiet) {
    console.log(`✓ cleared ${SEEDED_COLLECTIONS.map((c) => `${c}/`).join(', ')}`);
    console.log(`✓ cleared seeded Auth users (${TEST_USERS.length})`);
  }
}

// ── Seed: users ─────────────────────────────────────────────────────────────

async function seedUser(u) {
  // Pre-write the mirror so onUserCreate's `if (existing.exists) return;`
  // guard short-circuits — eliminates the race between trigger and seed.
  await db.doc(`users/${u.uid}`).set({
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: null,
    role: u.role,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastSignInAt: null,
    roleChangedAt: FieldValue.serverTimestamp(),
  });

  try {
    await auth.getUser(u.uid);
    await auth.updateUser(u.uid, { email: u.email, displayName: u.displayName });
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    await auth.createUser({
      uid: u.uid,
      email: u.email,
      emailVerified: true,
      displayName: u.displayName,
      password: 'devpass-not-used-in-emulator',
    });
  }

  // Trigger no-ops its own setCustomUserClaims when the mirror exists, so
  // we own claim assignment here.
  await auth.setCustomUserClaims(u.uid, { role: u.role });
}

// ── Seed: announcements + banner ───────────────────────────────────────────

async function seedAnnouncements() {
  for (const a of ANNOUNCEMENTS) {
    await db.collection('announcements').add({
      year: a.year,
      title: a.title,
      body: a.body,
      postedAt: Timestamp.fromMillis(a.postedAtMs),
      lastEditedAt: null,
    });
  }
}

async function seedConfig() {
  await db.doc('config/banner').set({ message: BANNER_MESSAGE });
}

// ── Seed: a single season ──────────────────────────────────────────────────

async function seedSeason(year, { status, currentWeek, publishedWeekCount, draftWeek }) {
  const teams = [0, 1, 2, 3].map((idx) => buildTeam(idx, publishedWeekCount));

  const weeks = [];
  for (let w = 0; w < publishedWeekCount; w++) {
    weeks.push(buildWeekResult(w, teams));
  }

  const awards = status === 'complete' ? buildAwards(teams) : null;
  const season = buildSeason(year, status, currentWeek, teams, awards);

  const seasonRef = db.doc(`seasons/${year}`);
  await seasonRef.set(season);

  for (const team of teams) {
    await seasonRef.collection('teams').doc(team.id).set(team);
  }
  for (const week of weeks) {
    await seasonRef.collection('weeks').doc(String(week.weekNumber)).set(week);
  }
  if (draftWeek != null) {
    for (const team of teams) {
      const entry = buildEntry(year, draftWeek - 1, team);
      await seasonRef.collection('entries').doc(`${draftWeek}_${team.id}`).set(entry);
    }
  }
}

// ── Seed: top-level orchestrator ───────────────────────────────────────────

async function seedCommand() {
  header('seed');
  await clearCommand({ quiet: true });
  console.log('✓ wiped seeded collections + test auth users');

  for (const u of TEST_USERS) await seedUser(u);
  console.log(`✓ seeded ${TEST_USERS.length} test users (owner, admin, user)`);

  await seedConfig();
  console.log('✓ seeded config/banner');

  await seedAnnouncements();
  console.log(`✓ seeded ${ANNOUNCEMENTS.length} announcements`);

  await seedSeason(ACTIVE_YEAR, {
    status: 'active',
    currentWeek: ACTIVE_WEEKS_PUBLISHED + 1,
    publishedWeekCount: ACTIVE_WEEKS_PUBLISHED,
    draftWeek: ACTIVE_WEEKS_PUBLISHED + 1,
  });
  console.log(`✓ seeded ${ACTIVE_YEAR} (active, ${ACTIVE_WEEKS_PUBLISHED} weeks + 1 draft)`);

  await seedSeason(COMPLETE_YEAR, {
    status: 'complete',
    currentWeek: WEEKS_PER_SEASON,
    publishedWeekCount: WEEKS_PER_SEASON,
    draftWeek: null,
  });
  console.log(`✓ seeded ${COMPLETE_YEAR} (complete, ${WEEKS_PER_SEASON} weeks + awards)`);

  console.log('───────────────────────────────────────────────────');
  console.log('Test sign-in (any password works on the auth emulator):');
  for (const u of TEST_USERS) {
    console.log(`  ${u.role.padEnd(5)} → ${u.email}`);
  }
}

// ── Status ──────────────────────────────────────────────────────────────────

async function statusCommand() {
  header('status');
  for (const col of ['users', 'audit', 'announcements', 'config']) {
    const snap = await db.collection(col).count().get();
    console.log(`${col.padEnd(15)} ${snap.data().count}`);
  }
  const seasonsSnap = await db.collection('seasons').get();
  console.log(`seasons/        ${seasonsSnap.size}`);
  for (const seasonDoc of seasonsSnap.docs) {
    const [teamsSnap, weeksSnap, entriesSnap] = await Promise.all([
      seasonDoc.ref.collection('teams').count().get(),
      seasonDoc.ref.collection('weeks').count().get(),
      seasonDoc.ref.collection('entries').count().get(),
    ]);
    console.log(
      `  ${seasonDoc.id}: ${teamsSnap.data().count} teams, ${weeksSnap.data().count} weeks, ${entriesSnap.data().count} entries`,
    );
  }
  const authUsers = await auth.listUsers();
  console.log(`auth users      ${authUsers.users.length}`);
}

// ── Entry point ────────────────────────────────────────────────────────────

async function main() {
  const [, , subcommand = 'seed'] = process.argv;
  switch (subcommand) {
    case 'seed':
      return seedCommand();
    case 'clear':
      return clearCommand();
    case 'status':
      return statusCommand();
    default:
      usage(`unknown subcommand "${subcommand}"`);
  }
}

try {
  await main();
} catch (e) {
  console.error(`\nError: ${e.message ?? e}`);
  if (e.stack) console.error(e.stack);
  process.exit(1);
}
