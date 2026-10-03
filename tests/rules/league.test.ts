/**
 * Firestore rules: league requests (spec 009)
 *
 * leagueTeams {signed-in read, anon read, client writes}; teamProposals
 * {captain/admin read incl. missing doc, other/anon read, all client
 * writes}; registrations {create guards, allowed updates, status change,
 * after review, withdraw}; shooterLinkRequests {create/update/delete by
 * status}; shooterLinks {self read, writes}.
 */

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { asAnon, asRole, seed, seedProfile, seedUser, setupTestEnv } from './_helpers.js';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupTestEnv(); });
beforeEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });

const USER_UID = 'uMember';
const OTHER_UID = 'uOther';
const YEAR = new Date().getUTCFullYear();
const REG_ID = `${YEAR}_${USER_UID}`;

async function seedMember(uid = USER_UID, extra: Record<string, unknown> = {}): Promise<void> {
  await seedUser(env, uid, 'user', extra);
  await seedProfile(env, uid);
}

async function seedDoc(path: string, data: Record<string, unknown>): Promise<void> {
  await seed(env, async (db) => { await setDoc(doc(db, path), data); });
}

describe('leagueTeams', () => {
  beforeEach(async () => {
    await seedDoc('leagueTeams/crazy-guns', { name: 'Crazy Guns', captainUid: null, seasons: [2025] });
  });

  it('signed-in user can read; anon cannot', async () => {
    await assertSucceeds(getDoc(doc(asRole(env, USER_UID, 'user'), 'leagueTeams', 'crazy-guns')));
    await assertFails(getDoc(doc(asAnon(env), 'leagueTeams', 'crazy-guns')));
  });

  it('no client can write, admin included', async () => {
    await assertFails(setDoc(doc(asRole(env, USER_UID, 'user'), 'leagueTeams', 'x'), { name: 'X' }));
    await assertFails(updateDoc(doc(asRole(env, 'uAdmin', 'admin'), 'leagueTeams', 'crazy-guns'), { captainUid: 'uAdmin' }));
  });
});

describe('teamProposals', () => {
  const id = `${YEAR}_${USER_UID}`;
  beforeEach(async () => {
    await seedDoc(`teamProposals/${id}`, { captainUid: USER_UID, year: YEAR, status: 'draft', shooters: [] });
  });

  it('captain and admin can read; another user and anon cannot', async () => {
    await assertSucceeds(getDoc(doc(asRole(env, USER_UID, 'user'), 'teamProposals', id)));
    await assertSucceeds(getDoc(doc(asRole(env, 'uAdmin', 'admin'), 'teamProposals', id)));
    await assertFails(getDoc(doc(asRole(env, OTHER_UID, 'user'), 'teamProposals', id)));
    await assertFails(getDoc(doc(asAnon(env), 'teamProposals', id)));
  });

  it('captain can probe for a proposal that does not exist yet', async () => {
    await assertSucceeds(getDoc(doc(asRole(env, USER_UID, 'user'), 'teamProposals', `${YEAR + 1}_${USER_UID}`)));
  });

  it('every client write is denied, the captain included', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(setDoc(doc(db, 'teamProposals', `${YEAR + 1}_${USER_UID}`), { captainUid: USER_UID, status: 'draft' }));
    await assertFails(updateDoc(doc(db, 'teamProposals', id), { status: 'submitted' }));
    await assertFails(deleteDoc(doc(db, 'teamProposals', id)));
    await assertFails(updateDoc(doc(asRole(env, 'uAdmin', 'admin'), 'teamProposals', id), { status: 'approved' }));
  });
});

function validRegistration(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uid: USER_UID,
    year: YEAR,
    dependentIds: [],
    preferredLeagueTeamId: null,
    note: null,
    status: 'submitted',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  };
}

describe('registrations create', () => {
  beforeEach(async () => { await seedMember(); });

  it('member can register for this year and next year', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertSucceeds(setDoc(doc(db, 'registrations', REG_ID), validRegistration({
      dependentIds: ['d1'], preferredLeagueTeamId: 'crazy-guns', note: 'Any team is fine',
    })));
    await assertSucceeds(setDoc(doc(db, 'registrations', `${YEAR + 1}_${USER_UID}`), validRegistration({ year: YEAR + 1 })));
  });

  it('rejects a doc id that does not match year and uid', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(setDoc(doc(db, 'registrations', `${YEAR + 1}_${USER_UID}`), validRegistration()));
    await assertFails(setDoc(doc(db, 'registrations', `${YEAR}_${OTHER_UID}`), validRegistration({ uid: OTHER_UID })));
  });

  it('rejects a year outside this year and next', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(setDoc(doc(db, 'registrations', `${YEAR - 1}_${USER_UID}`), validRegistration({ year: YEAR - 1 })));
    await assertFails(setDoc(doc(db, 'registrations', `${YEAR + 2}_${USER_UID}`), validRegistration({ year: YEAR + 2 })));
  });

  it('rejects a status other than submitted and an extra key', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(setDoc(doc(db, 'registrations', REG_ID), validRegistration({ status: 'placed' })));
    await assertFails(setDoc(doc(db, 'registrations', REG_ID), validRegistration({ placedLeagueTeamId: 'x' })));
  });

  it('rejects 7 dependents and a 281-char note', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(setDoc(doc(db, 'registrations', REG_ID), validRegistration({
      dependentIds: ['1', '2', '3', '4', '5', '6', '7'],
    })));
    await assertFails(setDoc(doc(db, 'registrations', REG_ID), validRegistration({ note: 'x'.repeat(281) })));
  });

  it('rejects when a team proposal exists for the same season', async () => {
    await seedDoc(`teamProposals/${REG_ID}`, { captainUid: USER_UID, year: YEAR, status: 'draft' });
    await assertFails(setDoc(doc(asRole(env, USER_UID, 'user'), 'registrations', REG_ID), validRegistration()));
  });

  it('rejects a member without a profile, and a deactivated member', async () => {
    await seedUser(env, 'uNoProfile', 'user');
    await assertFails(setDoc(doc(asRole(env, 'uNoProfile', 'user'), 'registrations', `${YEAR}_uNoProfile`),
      validRegistration({ uid: 'uNoProfile' })));
    await seedUser(env, USER_UID, 'user', { status: 'deactivated' });
    await assertFails(setDoc(doc(asRole(env, USER_UID, 'user'), 'registrations', REG_ID), validRegistration()));
  });
});

describe('registrations read, update, withdraw', () => {
  beforeEach(async () => {
    await seedMember();
    await seedDoc(`registrations/${REG_ID}`, {
      uid: USER_UID, year: YEAR, dependentIds: [], preferredLeagueTeamId: null, note: null,
      status: 'submitted', createdAt: new Date(), updatedAt: new Date(),
    });
  });

  it('member and admin can read; another user cannot', async () => {
    await assertSucceeds(getDoc(doc(asRole(env, USER_UID, 'user'), 'registrations', REG_ID)));
    await assertSucceeds(getDoc(doc(asRole(env, 'uAdmin', 'admin'), 'registrations', REG_ID)));
    await assertFails(getDoc(doc(asRole(env, OTHER_UID, 'user'), 'registrations', REG_ID)));
  });

  it('member can change dependents, preference and note while submitted', async () => {
    await assertSucceeds(updateDoc(doc(asRole(env, USER_UID, 'user'), 'registrations', REG_ID), {
      dependentIds: ['d1'], preferredLeagueTeamId: 'crazy-guns', note: 'Thursdays', updatedAt: serverTimestamp(),
    }));
  });

  it('member CANNOT change status or year', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(updateDoc(doc(db, 'registrations', REG_ID), { status: 'placed', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'registrations', REG_ID), { year: YEAR + 1, updatedAt: serverTimestamp() }));
  });

  it('member can withdraw (delete) while submitted; another user cannot', async () => {
    await assertFails(deleteDoc(doc(asRole(env, OTHER_UID, 'user'), 'registrations', REG_ID)));
    await assertSucceeds(deleteDoc(doc(asRole(env, USER_UID, 'user'), 'registrations', REG_ID)));
  });

  it('after placement the member can neither edit nor delete', async () => {
    await seedDoc(`registrations/${REG_ID}`, {
      uid: USER_UID, year: YEAR, dependentIds: [], preferredLeagueTeamId: null, note: null,
      status: 'placed', createdAt: new Date(), updatedAt: new Date(),
    });
    const db = asRole(env, USER_UID, 'user');
    await assertFails(updateDoc(doc(db, 'registrations', REG_ID), { note: 'x', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, 'registrations', REG_ID)));
  });
});

function validLinkRequest(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    shooterName: 'Pat Shooter',
    status: 'submitted',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  };
}

describe('shooterLinkRequests', () => {
  beforeEach(async () => { await seedMember(); });

  it('member can create with and without a note', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertSucceeds(setDoc(doc(db, 'shooterLinkRequests', USER_UID), validLinkRequest({ note: 'Also shot as Patrick' })));
    await seedMember(OTHER_UID);
    await assertSucceeds(setDoc(doc(asRole(env, OTHER_UID, 'user'), 'shooterLinkRequests', OTHER_UID), validLinkRequest()));
  });

  it('rejects another uid, a 61-char name, a status other than submitted, and an extra key', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(setDoc(doc(db, 'shooterLinkRequests', OTHER_UID), validLinkRequest()));
    await assertFails(setDoc(doc(db, 'shooterLinkRequests', USER_UID), validLinkRequest({ shooterName: 'x'.repeat(61) })));
    await assertFails(setDoc(doc(db, 'shooterLinkRequests', USER_UID), validLinkRequest({ status: 'approved' })));
    await assertFails(setDoc(doc(db, 'shooterLinkRequests', USER_UID), validLinkRequest({ reviewNote: 'ok' })));
  });

  it('rejects a deactivated member', async () => {
    await seedUser(env, USER_UID, 'user', { status: 'deactivated' });
    await assertFails(setDoc(doc(asRole(env, USER_UID, 'user'), 'shooterLinkRequests', USER_UID), validLinkRequest()));
  });

  it('member can edit and delete while submitted, not change status', async () => {
    await seedDoc(`shooterLinkRequests/${USER_UID}`, { shooterName: 'Pat', status: 'submitted', createdAt: new Date(), updatedAt: new Date() });
    const db = asRole(env, USER_UID, 'user');
    await assertSucceeds(updateDoc(doc(db, 'shooterLinkRequests', USER_UID), { shooterName: 'Pat Shooter', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'shooterLinkRequests', USER_UID), { status: 'approved', updatedAt: serverTimestamp() }));
    await assertFails(getDoc(doc(asRole(env, OTHER_UID, 'user'), 'shooterLinkRequests', USER_UID)));
    await assertSucceeds(getDoc(doc(asRole(env, 'uAdmin', 'admin'), 'shooterLinkRequests', USER_UID)));
    await assertSucceeds(deleteDoc(doc(db, 'shooterLinkRequests', USER_UID)));
  });

  it('after approval the member can neither edit nor delete; after decline they can delete', async () => {
    await seedDoc(`shooterLinkRequests/${USER_UID}`, { shooterName: 'Pat', status: 'approved', createdAt: new Date(), updatedAt: new Date() });
    const db = asRole(env, USER_UID, 'user');
    await assertFails(updateDoc(doc(db, 'shooterLinkRequests', USER_UID), { shooterName: 'X', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, 'shooterLinkRequests', USER_UID)));
    await seedDoc(`shooterLinkRequests/${USER_UID}`, { shooterName: 'Pat', status: 'declined', createdAt: new Date(), updatedAt: new Date() });
    await assertSucceeds(deleteDoc(doc(db, 'shooterLinkRequests', USER_UID)));
  });
});

describe('shooterLinks (reserved for M3)', () => {
  beforeEach(async () => {
    await seedMember();
    await seedDoc(`shooterLinks/${USER_UID}`, { shooterName: 'Pat Shooter', nameKey: 'pat shooter' });
  });

  it('self and admin can read; another user cannot; nobody writes', async () => {
    await assertSucceeds(getDoc(doc(asRole(env, USER_UID, 'user'), 'shooterLinks', USER_UID)));
    await assertSucceeds(getDoc(doc(asRole(env, 'uAdmin', 'admin'), 'shooterLinks', USER_UID)));
    await assertFails(getDoc(doc(asRole(env, OTHER_UID, 'user'), 'shooterLinks', USER_UID)));
    await assertFails(setDoc(doc(asRole(env, USER_UID, 'user'), 'shooterLinks', USER_UID), { shooterName: 'Someone Else' }));
  });
});
