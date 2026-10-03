/**
 * Firestore rules: coordinator review (spec 010)
 *
 * captainChanges {nominator/nominee/admin read, member queries, client
 * writes}; registrations {delete while declined}; the review queue's
 * status queries {admin allowed, member denied}.
 */

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { asAnon, asRole, seed, seedProfile, seedUser, setupTestEnv } from './_helpers.js';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupTestEnv(); });
beforeEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });

const CAPTAIN = 'uCaptain';
const NOMINEE = 'uNominee';
const OTHER = 'uOther';
const YEAR = new Date().getUTCFullYear();

async function seedDoc(path: string, data: Record<string, unknown>): Promise<void> {
  await seed(env, async (db) => { await setDoc(doc(db, path), data); });
}

describe('captainChanges', () => {
  beforeEach(async () => {
    await seedDoc('captainChanges/crazy-guns', {
      leagueTeamId: 'crazy-guns', teamName: 'Crazy Guns', fromUid: CAPTAIN, toUid: NOMINEE, status: 'nominated',
    });
  });

  it('nominating captain, nominee, and admin can read; another member and anon cannot', async () => {
    await assertSucceeds(getDoc(doc(asRole(env, CAPTAIN, 'user'), 'captainChanges', 'crazy-guns')));
    await assertSucceeds(getDoc(doc(asRole(env, NOMINEE, 'user'), 'captainChanges', 'crazy-guns')));
    await assertSucceeds(getDoc(doc(asRole(env, 'uAdmin', 'admin'), 'captainChanges', 'crazy-guns')));
    await assertFails(getDoc(doc(asRole(env, OTHER, 'user'), 'captainChanges', 'crazy-guns')));
    await assertFails(getDoc(doc(asAnon(env), 'captainChanges', 'crazy-guns')));
  });

  it('members can query their own handoffs only', async () => {
    const nominee = asRole(env, NOMINEE, 'user');
    await assertSucceeds(getDocs(query(collection(nominee, 'captainChanges'), where('toUid', '==', NOMINEE))));
    const captain = asRole(env, CAPTAIN, 'user');
    await assertSucceeds(getDocs(query(collection(captain, 'captainChanges'), where('fromUid', '==', CAPTAIN))));
    await assertFails(getDocs(query(collection(nominee, 'captainChanges'), where('toUid', '==', OTHER))));
    await assertFails(getDocs(collection(nominee, 'captainChanges')));
  });

  it('no client can write, admin and nominee included', async () => {
    await assertFails(updateDoc(doc(asRole(env, NOMINEE, 'user'), 'captainChanges', 'crazy-guns'), { status: 'accepted' }));
    await assertFails(updateDoc(doc(asRole(env, 'uAdmin', 'admin'), 'captainChanges', 'crazy-guns'), { status: 'approved' }));
    await assertFails(setDoc(doc(asRole(env, CAPTAIN, 'user'), 'captainChanges', 'other-team'), { fromUid: CAPTAIN, toUid: NOMINEE }));
    await assertFails(deleteDoc(doc(asRole(env, CAPTAIN, 'user'), 'captainChanges', 'crazy-guns')));
  });
});

describe('registrations after review', () => {
  const id = `${YEAR}_${CAPTAIN}`;
  const reg = (status: string) => ({
    uid: CAPTAIN, year: YEAR, dependentIds: [], preferredLeagueTeamId: null, note: null,
    status, createdAt: new Date(), updatedAt: new Date(),
  });

  beforeEach(async () => {
    await seedUser(env, CAPTAIN, 'user');
    await seedProfile(env, CAPTAIN);
  });

  it('member can clear a declined request but not a placed one', async () => {
    const db = asRole(env, CAPTAIN, 'user');
    await seedDoc(`registrations/${id}`, reg('placed'));
    await assertFails(deleteDoc(doc(db, 'registrations', id)));
    await seedDoc(`registrations/${id}`, reg('declined'));
    await assertFails(deleteDoc(doc(asRole(env, OTHER, 'user'), 'registrations', id)));
    await assertSucceeds(deleteDoc(doc(db, 'registrations', id)));
  });

  it('member cannot edit a declined request', async () => {
    await seedDoc(`registrations/${id}`, reg('declined'));
    await assertFails(updateDoc(doc(asRole(env, CAPTAIN, 'user'), 'registrations', id), { note: 'again' }));
  });
});

describe('review queue queries', () => {
  beforeEach(async () => {
    await seedDoc(`teamProposals/${YEAR}_${CAPTAIN}`, { captainUid: CAPTAIN, year: YEAR, status: 'submitted', shooters: [] });
    await seedDoc(`registrations/${YEAR}_${OTHER}`, { uid: OTHER, year: YEAR, status: 'submitted' });
    await seedDoc(`shooterLinkRequests/${OTHER}`, { shooterName: 'Pat', status: 'submitted' });
    await seedDoc('leagueTeams/crazy-guns', { name: 'Crazy Guns', captainUid: CAPTAIN, seasons: [YEAR] });
  });

  it('admin can list submitted requests and accepted handoffs', async () => {
    const db = asRole(env, 'uAdmin', 'admin');
    for (const name of ['teamProposals', 'registrations', 'shooterLinkRequests', 'captainChanges']) {
      await assertSucceeds(getDocs(query(collection(db, name), where('status', '==', 'submitted'))));
    }
    await assertSucceeds(getDocs(query(collection(db, 'leagueTeams'), where('captainUid', '!=', null))));
  });

  it('a member cannot list the queue', async () => {
    const db = asRole(env, CAPTAIN, 'user');
    for (const name of ['teamProposals', 'registrations', 'shooterLinkRequests']) {
      await assertFails(getDocs(query(collection(db, name), where('status', '==', 'submitted'))));
    }
  });
});
