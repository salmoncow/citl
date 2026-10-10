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
import { syncLeagueTeams } from './lib/league-teams.js';

import {
  ACTIVE_YEAR,
  COMPLETE_YEAR,
  WEEKS_PER_SEASON,
  ACTIVE_WEEKS_PUBLISHED,
  TEST_USERS,
  SEED_TERMS_VERSION,
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

const SEEDED_COLLECTIONS = [
  'users', 'profiles', 'audit', 'announcements', 'config', 'seasons',
  // Spec 009
  'leagueTeams', 'teamProposals', 'registrations', 'shooterLinkRequests', 'shooterLinks',
  // Spec 010
  'captainChanges',
];

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
  const restored = await restoreOtherMirrors();
  if (!quiet) {
    console.log(`✓ cleared ${SEEDED_COLLECTIONS.map((c) => `${c}/`).join(', ')}`);
    console.log(`✓ cleared seeded Auth users (${TEST_USERS.length})`);
    console.log(`✓ restored users/ mirror for ${restored} other Auth user(s)`);
  }
}

/**
 * Clearing users/ also removes the mirror of every Auth user the seed did
 * not create (e.g. a fake-Google account made while testing). Without a
 * mirror that account can't finish profile setup (spec 008), so write it
 * back from the Auth record, keeping its role claim. Profiles stay
 * cleared; the account goes through first-sign-in setup again.
 */
async function restoreOtherMirrors() {
  const seeded = new Set(TEST_USERS.map((u) => u.uid));
  let count = 0;
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const r of page.users) {
      if (seeded.has(r.uid)) continue;
      const role = r.customClaims?.role ?? 'user';
      if (!r.customClaims?.role) await auth.setCustomUserClaims(r.uid, { ...r.customClaims, role });
      await db.doc(`users/${r.uid}`).set({
        uid: r.uid,
        email: r.email ?? null,
        displayName: r.displayName ?? null,
        photoURL: r.photoURL ?? null,
        role,
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastSignInAt: null,
        roleChangedAt: FieldValue.serverTimestamp(),
      });
      count++;
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return count;
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
    status: u.status ?? 'active',
    ...(u.status === 'deactivated'
      ? { deactivatedAt: FieldValue.serverTimestamp(), statusChangedAt: FieldValue.serverTimestamp() }
      : {}),
  });

  // Spec 008: seeded members get a completed profile so they skip the
  // first-sign-in completion step.
  if (u.profile) {
    await db.doc(`profiles/${u.uid}`).set({
      ...u.profile,
      acceptedTermsAt: FieldValue.serverTimestamp(),
      termsVersion: SEED_TERMS_VERSION,
      adultAttested: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

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

// ── Seed: league requests (spec 009) ───────────────────────────────────────

/** Registration season the UI targets: latest season active → that year, else next. */
const REQUEST_YEAR = COMPLETE_YEAR + 1;

/** A timestamp `days` before now, so queue ages and oldest-first order are visible. */
const daysAgo = (days) => Timestamp.fromMillis(Date.now() - days * 86_400_000);

const self = (name) => ({ kind: 'self', name, rookie: false, minor: false });
const named = (name, rookie = false) => ({ kind: 'named', name, rookie, minor: false });

async function seedProposal(captainUid, fields, days) {
  await db.doc(`teamProposals/${REQUEST_YEAR}_${captainUid}`).set({
    captainUid,
    year: REQUEST_YEAR,
    purpose: 'initial',
    teamSource: 'returning',
    status: 'submitted',
    reviewNote: null,
    submittedAt: daysAgo(days),
    reviewedBy: null,
    reviewedAt: null,
    createdAt: daysAgo(days + 1),
    updatedAt: daysAgo(days),
    ...fields,
  });
}

async function seedRegistration(uid, fields, days) {
  await db.doc(`registrations/${REQUEST_YEAR}_${uid}`).set({
    uid,
    year: REQUEST_YEAR,
    dependentIds: [],
    preferredLeagueTeamId: null,
    note: null,
    status: 'submitted',
    createdAt: daysAgo(days),
    updatedAt: daysAgo(days),
    ...fields,
  });
}

async function seedLinkRequest(uid, shooterName, note, days) {
  await db.doc(`shooterLinkRequests/${uid}`).set({
    shooterName,
    ...(note ? { note } : {}),
    status: 'submitted',
    createdAt: daysAgo(days),
    updatedAt: daysAgo(days),
  });
}

/**
 * League requests for the admin Requests tab (spec 010). Together they show
 * every order dependency the queue flags (src/components/admin-tabs/request-list.ts):
 *   D1  name link before that member's join request (seed-member) or proposal (seed-rival)
 *   D2  REQUEST_YEAR proposals before REQUEST_YEAR join requests (seed-member, seed-family)
 *   D4  Eagles already has a captain, so seed-rival's proposal can only be rejected
 *   D5  seed-captain's roster change before the Eagles handoff to seed-nominee
 * plus competing Hawks proposals (seed-user, seed-hawk), a proposal that drops a
 * shooter already on the REQUEST_YEAR team (Walt Keller), and link requests with
 * no exact match (seed-rival) and no match from an inactive account (seed-deactivated).
 */
async function seedLeagueRequests() {
  await syncLeagueTeams(db, { FieldValue });
  const now = FieldValue.serverTimestamp();

  // Eagles is an approved REQUEST_YEAR team with a captain. The season doc
  // itself is not written, so the public site doesn't list REQUEST_YEAR.
  await db.doc('leagueTeams/eagles').update({
    captainUid: 'seed-captain', seasons: FieldValue.arrayUnion(REQUEST_YEAR), updatedAt: now,
  });
  await db.doc(`seasons/${REQUEST_YEAR}/teams/eagles`).set({
    name: 'Eagles',
    captain: 'Greg Litchfield',
    leagueTeamId: 'eagles',
    captainUid: 'seed-captain',
    shooters: [
      ['Greg Litchfield', 42], ['Pete Sandoval', 40], ['Rick Mancuso', 38], ['Walt Keller', 35],
    ].map(([name, startingAvg], i) => ({
      id: `${name.toLowerCase().replace(/\s+/g, '-')}-${REQUEST_YEAR}-${i}`,
      name, rookie: name === 'Walt Keller', startingAvg, finalAvg: null, weeksShot: null, scores: [],
    })),
    totals: { targets: [], rankPoints: [], bonusPoints: [] },
  });
  // How Walt Keller got there: a join request already placed (not in the queue).
  await db.doc(`registrations/${REQUEST_YEAR}_walt-keller`).set({
    uid: 'walt-keller', year: REQUEST_YEAR, dependentIds: [], preferredLeagueTeamId: 'eagles', note: null,
    status: 'placed', placedLeagueTeamId: 'eagles', reviewNote: null, createdAt: daysAgo(20), updatedAt: daysAgo(18),
  });

  // seed-user: one dependent and a proposal claiming Hawks.
  await db.doc('profiles/seed-user/dependents/seed-dep-1').set({
    firstName: 'Riley', lastName: 'User', birthYear: REQUEST_YEAR - 13, createdAt: now, updatedAt: now,
  });
  await seedProposal('seed-user', {
    leagueTeamId: 'hawks',
    teamName: 'Hawks',
    shooters: [
      self('Seed User'),
      { kind: 'dependent', name: 'Riley U.', rookie: true, minor: true, dependentId: 'seed-dep-1' },
      named('Dave Brennan'),
      named('Jordan Pike', true),
      named('Casey Moore', true),
    ],
  }, 9);

  // seed-hawk: a competing proposal for Hawks (no captain yet).
  await seedProposal('seed-hawk', {
    leagueTeamId: 'hawks',
    teamName: 'Hawks',
    shooters: [self('Sam Rivera'), named('Frank Holt'), named('Larry Pence'), named('Joe Vance')],
  }, 4);

  // seed-captain: a roster change for Eagles that drops Walt Keller (D5).
  await seedProposal('seed-captain', {
    purpose: 'change',
    leagueTeamId: 'eagles',
    teamName: 'Eagles',
    shooters: [self('Greg Litchfield'), named('Pete Sandoval'), named('Rick Mancuso'), named('Ned Carver', true)],
  }, 6);
  // ...and an accepted handoff of Eagles to seed-nominee, older than the change.
  await db.doc('captainChanges/eagles').set({
    leagueTeamId: 'eagles',
    teamName: 'Eagles',
    fromUid: 'seed-captain',
    fromName: 'Greg Litchfield',
    toUid: 'seed-nominee',
    toName: 'Pete Sandoval',
    status: 'accepted',
    reviewNote: null,
    createdAt: daysAgo(8),
    updatedAt: daysAgo(7),
    respondedAt: daysAgo(7),
    reviewedBy: null,
    reviewedAt: null,
  });

  // seed-rival: claims Eagles though it has a captain (D4), with a pending
  // name link that has no exact match (D1).
  await seedProposal('seed-rival', {
    leagueTeamId: 'eagles',
    teamName: 'Eagles',
    shooters: [self('Carl Webb'), named('Bill Frey'), named('Hank Olson')],
  }, 3);
  await seedLinkRequest('seed-rival', 'Carl Web', 'Shot for the Falcons.', 5);

  // seed-member: an individual registration and an exact-match link (D1, D2).
  await seedRegistration('seed-member', { preferredLeagueTeamId: 'eagles', note: 'Can shoot most Tuesdays.' }, 2);
  await seedLinkRequest('seed-member', 'Aaron Klein', 'Shot for the Eagles in 2024 and 2025.', 1);

  // seed-family: the oldest request, a family registration with two
  // dependents. It still sorts after the proposals (D2).
  for (const [id, firstName, birthYear] of [['seed-dep-2', 'Maya', REQUEST_YEAR - 15], ['seed-dep-3', 'Leo', REQUEST_YEAR - 12]]) {
    await db.doc(`profiles/seed-family/dependents/${id}`).set({ firstName, lastName: 'Ortega', birthYear, createdAt: now, updatedAt: now });
  }
  await seedRegistration('seed-family', {
    dependentIds: ['seed-dep-2', 'seed-dep-3'],
    preferredLeagueTeamId: 'falcons',
    note: 'Me and my two kids. Happy to split across teams.',
  }, 14);

  // seed-deactivated: a link to a name on no scorecard, from an inactive account.
  await seedLinkRequest('seed-deactivated', 'Jon Smiht', null, 10);
}

// ── Seed: top-level orchestrator ───────────────────────────────────────────

async function seedCommand() {
  header('seed');
  await clearCommand({ quiet: true });
  console.log('✓ wiped seeded collections + test auth users; restored other users\' mirrors');

  for (const u of TEST_USERS) await seedUser(u);
  console.log(`✓ seeded ${TEST_USERS.length} test users`);

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

  await seedLeagueRequests();
  console.log(`✓ seeded league teams, Eagles ${REQUEST_YEAR} team, and ${REQUEST_YEAR} requests (4 proposals, 2 registrations, 3 links, 1 handoff)`);

  console.log('───────────────────────────────────────────────────');
  console.log('Test sign-in (any password works on the auth emulator):');
  for (const u of TEST_USERS) {
    console.log(`  ${u.role.padEnd(5)} → ${u.email}`);
  }
}

// ── Status ──────────────────────────────────────────────────────────────────

async function statusCommand() {
  header('status');
  for (const col of ['users', 'profiles', 'audit', 'announcements', 'config', 'leagueTeams', 'teamProposals', 'registrations', 'shooterLinkRequests', 'captainChanges']) {
    const snap = await db.collection(col).count().get();
    console.log(`${col.padEnd(15)} ${snap.data().count}`);
  }
  // listDocuments includes seasons with no doc but a teams subcollection
  // (the seeded request year).
  const seasonRefs = await db.collection('seasons').listDocuments();
  console.log(`seasons/        ${seasonRefs.length}`);
  for (const seasonDoc of seasonRefs.map((ref) => ({ id: ref.id, ref }))) {
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
