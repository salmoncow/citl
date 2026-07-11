/**
 * Firestore rules: seasons/{year} and subcollections (teams, weeks, entries).
 *
 * Verifies the migration from `admin: true` to role-based access preserves
 * existing semantics: public read on seasons/teams/weeks; owner+admin-only
 * write across all four collections; entries are owner+admin-only end-to-end.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { asAnon, asRole, seed, setupTestEnv } from './_helpers.js';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupTestEnv(); });
beforeEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });

const YEAR = '2026';
const TEAM_ID = 'team-1';
const WEEK_NUM = 'week-1';
const ENTRY_ID = 'entry-1';

async function seedSeason(env: RulesTestEnvironment) {
  await seed(env, async (db) => {
    await setDoc(doc(db, 'seasons', YEAR), { year: YEAR });
    await setDoc(doc(db, 'seasons', YEAR, 'teams', TEAM_ID), { name: 'Team 1' });
    await setDoc(doc(db, 'seasons', YEAR, 'weeks', WEEK_NUM), { weekNumber: 1 });
    await setDoc(doc(db, 'seasons', YEAR, 'entries', ENTRY_ID), { entryId: ENTRY_ID });
  });
}

describe('seasons/{year} — public read, owner/admin write', () => {
  beforeEach(async () => { await seedSeason(env); });

  it('anon can read season + teams + weeks', async () => {
    const db = asAnon(env);
    await assertSucceeds(getDoc(doc(db, 'seasons', YEAR)));
    await assertSucceeds(getDocs(collection(db, 'seasons', YEAR, 'teams')));
    await assertSucceeds(getDocs(collection(db, 'seasons', YEAR, 'weeks')));
  });

  it('user role can read season + teams + weeks but NOT entries', async () => {
    const db = asRole(env, 'u', 'user');
    await assertSucceeds(getDoc(doc(db, 'seasons', YEAR)));
    await assertSucceeds(getDocs(collection(db, 'seasons', YEAR, 'teams')));
    await assertSucceeds(getDocs(collection(db, 'seasons', YEAR, 'weeks')));
    await assertFails(getDocs(collection(db, 'seasons', YEAR, 'entries')));
  });

  it('owner can read everything including entries', async () => {
    const db = asRole(env, 'o', 'owner');
    await assertSucceeds(getDocs(collection(db, 'seasons', YEAR, 'entries')));
  });

  it('admin can read everything including entries', async () => {
    const db = asRole(env, 'a', 'admin');
    await assertSucceeds(getDocs(collection(db, 'seasons', YEAR, 'entries')));
  });
});

describe('seasons writes — owner/admin only', () => {
  beforeEach(async () => { await seedSeason(env); });

  it('user CANNOT write season', async () => {
    const db = asRole(env, 'u', 'user');
    await assertFails(setDoc(doc(db, 'seasons', YEAR), { name: 'X' }));
  });

  it('user CANNOT delete a team', async () => {
    const db = asRole(env, 'u', 'user');
    await assertFails(deleteDoc(doc(db, 'seasons', YEAR, 'teams', TEAM_ID)));
  });

  it('admin can create + update + delete a team', async () => {
    const db = asRole(env, 'a', 'admin');
    // setDoc against a missing doc creates; against an existing doc updates;
    // both gated by the same `create, update, delete` rule. Avoids flakiness
    // from the rules-unit-testing seed-visibility quirk.
    await assertSucceeds(setDoc(doc(db, 'seasons', YEAR, 'teams', 'new-team'), { name: 'New' }));
    await assertSucceeds(setDoc(doc(db, 'seasons', YEAR, 'teams', 'new-team'), { name: 'Renamed' }));
    await assertSucceeds(deleteDoc(doc(db, 'seasons', YEAR, 'teams', 'new-team')));
  });

  it('owner can write a week (publish)', async () => {
    const db = asRole(env, 'o', 'owner');
    await assertSucceeds(setDoc(doc(db, 'seasons', YEAR, 'weeks', 'new-week'), { status: 'published' }));
  });

  it('admin can create + update + delete an entry', async () => {
    const db = asRole(env, 'a', 'admin');
    await assertSucceeds(setDoc(doc(db, 'seasons', YEAR, 'entries', 'new-entry'), { e: 1 }));
    // setDoc tests the same `create, update` rule as updateDoc.
    await assertSucceeds(setDoc(doc(db, 'seasons', YEAR, 'entries', 'new-entry'), { e: 2 }));
    await assertSucceeds(deleteDoc(doc(db, 'seasons', YEAR, 'entries', 'new-entry')));
  });

  it('user CANNOT write any season collection', async () => {
    const db = asRole(env, 'u', 'user');
    await assertFails(setDoc(doc(db, 'seasons', YEAR, 'teams', 'x'), {}));
    await assertFails(setDoc(doc(db, 'seasons', YEAR, 'weeks', 'x'), {}));
    await assertFails(setDoc(doc(db, 'seasons', YEAR, 'entries', 'x'), {}));
  });
});

describe('deny gaps — anon writes, anon entry reads, week deletes (F-55)', () => {
  beforeEach(async () => { await seedSeason(env); });

  it('anon CANNOT write teams, weeks, or entries', async () => {
    const db = asAnon(env);
    await assertFails(setDoc(doc(db, 'seasons', YEAR, 'teams', 'x'), { name: 'X' }));
    await assertFails(setDoc(doc(db, 'seasons', YEAR, 'weeks', 'x'), { weekNumber: 9 }));
    await assertFails(setDoc(doc(db, 'seasons', YEAR, 'entries', 'x'), { e: 1 }));
  });

  it('anon CANNOT read entries (drafts are owner/admin-only)', async () => {
    const db = asAnon(env);
    await assertFails(getDocs(collection(db, 'seasons', YEAR, 'entries')));
  });

  it('no role can delete a published week — the rule grants only create/update', async () => {
    // Deleting a week doc would silently rewind public standings; the rules
    // deliberately omit delete, so it must stay implicit-deny even for admin/owner.
    await assertFails(deleteDoc(doc(asRole(env, 'a', 'admin'), 'seasons', YEAR, 'weeks', WEEK_NUM)));
    await assertFails(deleteDoc(doc(asRole(env, 'o', 'owner'), 'seasons', YEAR, 'weeks', WEEK_NUM)));
  });
});
