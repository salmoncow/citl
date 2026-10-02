/**
 * Firestore rules: profiles/{uid} (spec 008)
 *
 * Matrix: read {self, other, owner, admin, anon}; create {valid with and
 * without phone, each rejected field, mirror missing, deactivated, other
 * uid, anon}; update {name, phone, remove phone, terms re-acceptance,
 * each rejected change}; delete (Admin SDK only); reserved dependents
 * subcollection and notificationSettings/{uid} (denied).
 */

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { asAnon, asRole, seedProfile, seedUser, setupTestEnv } from './_helpers.js';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupTestEnv(); });
beforeEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });

const OWNER_UID = 'uOwner';
const ADMIN_UID = 'uAdmin';
const USER_UID = 'uUser';
const OTHER_UID = 'uOther';

function validProfile(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    displayName: 'Pat Shooter',
    acceptedTermsAt: serverTimestamp(),
    termsVersion: '2026-10',
    adultAttested: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  };
}

describe('profiles/{uid} read', () => {
  beforeEach(async () => {
    await seedUser(env, USER_UID, 'user');
    await seedProfile(env, USER_UID);
  });

  it('self can read own profile', async () => {
    await assertSucceeds(getDoc(doc(asRole(env, USER_UID, 'user'), 'profiles', USER_UID)));
  });

  it('another user CANNOT read the profile', async () => {
    await assertFails(getDoc(doc(asRole(env, OTHER_UID, 'user'), 'profiles', USER_UID)));
  });

  it('owner and admin can read the profile', async () => {
    await assertSucceeds(getDoc(doc(asRole(env, OWNER_UID, 'owner'), 'profiles', USER_UID)));
    await assertSucceeds(getDoc(doc(asRole(env, ADMIN_UID, 'admin'), 'profiles', USER_UID)));
  });

  it('anon CANNOT read the profile', async () => {
    await assertFails(getDoc(doc(asAnon(env), 'profiles', USER_UID)));
  });
});

describe('profiles/{uid} create', () => {
  beforeEach(async () => {
    await seedUser(env, USER_UID, 'user', { status: 'active' });
    await seedUser(env, OTHER_UID, 'user');
  });

  const create = (extra: Record<string, unknown> = {}) =>
    setDoc(doc(asRole(env, USER_UID, 'user'), 'profiles', USER_UID), validProfile(extra));

  it('self can create a valid profile without phone', async () => {
    await assertSucceeds(create());
  });

  it('self can create a valid profile with phone', async () => {
    await assertSucceeds(create({ phone: '+1 (217) 555-0100' }));
  });

  it('create succeeds when the mirror has no status field (missing = active)', async () => {
    await assertSucceeds(
      setDoc(doc(asRole(env, OTHER_UID, 'user'), 'profiles', OTHER_UID), validProfile()),
    );
  });

  it('rejects a missing adultAttested', async () => {
    const data = validProfile();
    delete data['adultAttested'];
    await assertFails(setDoc(doc(asRole(env, USER_UID, 'user'), 'profiles', USER_UID), data));
  });

  it('rejects adultAttested: false', async () => {
    await assertFails(create({ adultAttested: false }));
  });

  it('rejects acceptedTermsAt that is not request.time', async () => {
    await assertFails(create({ acceptedTermsAt: new Date('2020-01-01') }));
  });

  it('rejects an extra key (role)', async () => {
    await assertFails(create({ role: 'admin' }));
  });

  it('rejects an empty or whitespace-only name', async () => {
    await assertFails(create({ displayName: '' }));
    await assertFails(create({ displayName: '   ' }));
  });

  it('rejects an untrimmed name', async () => {
    await assertFails(create({ displayName: ' Pat ' }));
  });

  it('accepts a 60-char name and rejects a 61-char name', async () => {
    await assertSucceeds(create({ displayName: 'a'.repeat(60) }));
    await env.clearFirestore();
    await seedUser(env, USER_UID, 'user');
    await assertFails(create({ displayName: 'a'.repeat(61) }));
  });

  it('rejects an invalid phone', async () => {
    await assertFails(create({ phone: '217-555-CALL' }));
  });

  it('rejects a 21-char phone', async () => {
    await assertFails(create({ phone: '1'.repeat(21) }));
  });

  it('rejects create without a users/{uid} mirror', async () => {
    await assertFails(
      setDoc(doc(asRole(env, 'uNoMirror', 'user'), 'profiles', 'uNoMirror'), validProfile()),
    );
  });

  it('rejects create while deactivated', async () => {
    await seedUser(env, USER_UID, 'user', { status: 'deactivated' });
    await assertFails(create());
  });

  it('rejects create on another uid', async () => {
    await assertFails(
      setDoc(doc(asRole(env, USER_UID, 'user'), 'profiles', OTHER_UID), validProfile()),
    );
  });

  it('rejects anon create', async () => {
    await assertFails(setDoc(doc(asAnon(env), 'profiles', USER_UID), validProfile()));
  });
});

describe('profiles/{uid} update', () => {
  beforeEach(async () => {
    await seedUser(env, USER_UID, 'user', { status: 'active' });
    await seedProfile(env, USER_UID, { phone: '217 555 0100' });
  });

  const update = (data: Record<string, unknown>) =>
    updateDoc(doc(asRole(env, USER_UID, 'user'), 'profiles', USER_UID), {
      updatedAt: serverTimestamp(),
      ...data,
    });

  it('self can update displayName', async () => {
    await assertSucceeds(update({ displayName: 'New Name' }));
  });

  it('self can update phone', async () => {
    await assertSucceeds(update({ phone: '(217) 555-0199' }));
  });

  it('self can remove phone', async () => {
    await assertSucceeds(update({ phone: deleteField() }));
  });

  it('self can re-accept terms with acceptedTermsAt == request.time', async () => {
    await assertSucceeds(update({ termsVersion: '2027-01', acceptedTermsAt: serverTimestamp() }));
  });

  it('rejects a termsVersion change without a fresh acceptedTermsAt', async () => {
    await assertFails(update({ termsVersion: '2027-01' }));
  });

  it('rejects an update without updatedAt == request.time', async () => {
    await assertFails(
      updateDoc(doc(asRole(env, USER_UID, 'user'), 'profiles', USER_UID), { displayName: 'X' }),
    );
  });

  it('rejects changing createdAt', async () => {
    await assertFails(update({ createdAt: serverTimestamp() }));
  });

  it('rejects setting adultAttested: false', async () => {
    await assertFails(update({ adultAttested: false }));
  });

  it('rejects a backdated acceptedTermsAt', async () => {
    await assertFails(update({ acceptedTermsAt: new Date('2020-01-01') }));
  });

  it('rejects an invalid name on update', async () => {
    await assertFails(update({ displayName: 'a'.repeat(61) }));
  });

  it('rejects update while deactivated', async () => {
    await seedUser(env, USER_UID, 'user', { status: 'deactivated' });
    await assertFails(update({ displayName: 'New Name' }));
  });

  it('rejects another user updating the profile', async () => {
    await assertFails(
      updateDoc(doc(asRole(env, OTHER_UID, 'user'), 'profiles', USER_UID), {
        displayName: 'Hacked',
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('profiles/{uid} delete (Admin SDK only)', () => {
  beforeEach(async () => {
    await seedUser(env, USER_UID, 'user');
    await seedProfile(env, USER_UID);
  });

  it('self, admin and owner CANNOT delete a profile', async () => {
    await assertFails(deleteDoc(doc(asRole(env, USER_UID, 'user'), 'profiles', USER_UID)));
    await assertFails(deleteDoc(doc(asRole(env, ADMIN_UID, 'admin'), 'profiles', USER_UID)));
    await assertFails(deleteDoc(doc(asRole(env, OWNER_UID, 'owner'), 'profiles', USER_UID)));
  });
});

describe('reserved paths', () => {
  beforeEach(async () => {
    await seedUser(env, USER_UID, 'user');
    await seedProfile(env, USER_UID);
  });

  it('profiles/{uid}/dependents/{id} read and write denied for self', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(getDoc(doc(db, 'profiles', USER_UID, 'dependents', 'x')));
    await assertFails(setDoc(doc(db, 'profiles', USER_UID, 'dependents', 'x'), { name: 'Kid' }));
  });

  it('notificationSettings/{uid} read and write denied for self', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(getDoc(doc(db, 'notificationSettings', USER_UID)));
    await assertFails(setDoc(doc(db, 'notificationSettings', USER_UID), { weekly: true }));
  });
});
