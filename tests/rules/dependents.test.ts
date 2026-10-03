/**
 * Firestore rules: profiles/{uid}/dependents/{depId} (spec 009 AC-11)
 *
 * Matrix: read {self, other, admin, owner, anon}; create {valid, each
 * rejected field, birth-year bounds, deactivated, missing mirror, other
 * uid, admin}; update {allowed fields, createdAt change, bad birth year};
 * delete {self, other}.
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

const USER_UID = 'uGuardian';
const OTHER_UID = 'uOther';
const YEAR = new Date().getUTCFullYear();

function validDependent(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    firstName: 'Sam',
    lastName: 'Doe',
    birthYear: YEAR - 12,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  };
}

function depRef(db: ReturnType<typeof asRole>, uid = USER_UID, id = 'd1') {
  return doc(db, 'profiles', uid, 'dependents', id);
}

async function seedDependent(): Promise<void> {
  await seed(env, async (db) => {
    await setDoc(doc(db, 'profiles', USER_UID, 'dependents', 'd1'), {
      firstName: 'Sam', lastName: 'Doe', birthYear: YEAR - 12,
      createdAt: new Date(), updatedAt: new Date(),
    });
  });
}

describe('dependents read', () => {
  beforeEach(async () => {
    await seedUser(env, USER_UID, 'user');
    await seedProfile(env, USER_UID);
    await seedDependent();
  });

  it('guardian can read', async () => {
    await assertSucceeds(getDoc(depRef(asRole(env, USER_UID, 'user'))));
  });

  it('another user CANNOT read', async () => {
    await assertFails(getDoc(depRef(asRole(env, OTHER_UID, 'user'))));
  });

  it('admin and owner can read', async () => {
    await assertSucceeds(getDoc(depRef(asRole(env, 'uAdmin', 'admin'))));
    await assertSucceeds(getDoc(depRef(asRole(env, 'uOwner', 'owner'))));
  });

  it('anon CANNOT read', async () => {
    await assertFails(getDoc(depRef(asAnon(env))));
  });
});

describe('dependents create', () => {
  beforeEach(async () => {
    await seedUser(env, USER_UID, 'user');
    await seedProfile(env, USER_UID);
  });

  it('guardian can create a valid dependent', async () => {
    await assertSucceeds(setDoc(depRef(asRole(env, USER_UID, 'user')), validDependent()));
  });

  it('accepts the birth-year bounds (this year, this year - 18)', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertSucceeds(setDoc(depRef(db, USER_UID, 'a'), validDependent({ birthYear: YEAR })));
    await assertSucceeds(setDoc(depRef(db, USER_UID, 'b'), validDependent({ birthYear: YEAR - 18 })));
  });

  it('rejects birth year this year - 19, next year, and non-int', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(setDoc(depRef(db), validDependent({ birthYear: YEAR - 19 })));
    await assertFails(setDoc(depRef(db), validDependent({ birthYear: YEAR + 1 })));
    await assertFails(setDoc(depRef(db), validDependent({ birthYear: YEAR - 10.5 })));
    await assertFails(setDoc(depRef(db), validDependent({ birthYear: String(YEAR - 10) })));
  });

  it('rejects an extra key, a bad name, and a missing key', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(setDoc(depRef(db), validDependent({ email: 'kid@example.com' })));
    await assertFails(setDoc(depRef(db), validDependent({ firstName: '1Sam' })));
    await assertFails(setDoc(depRef(db), validDependent({ lastName: '' })));
    const { birthYear: _omit, ...noBirthYear } = validDependent();
    await assertFails(setDoc(depRef(db), noBirthYear));
  });

  it('rejects client timestamps', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(setDoc(depRef(db), validDependent({ createdAt: new Date(2020, 0, 1) })));
  });

  it('rejects a deactivated guardian and a missing mirror', async () => {
    await seedUser(env, USER_UID, 'user', { status: 'deactivated' });
    await assertFails(setDoc(depRef(asRole(env, USER_UID, 'user')), validDependent()));
    await assertFails(setDoc(depRef(asRole(env, 'uNoMirror', 'user'), 'uNoMirror'), validDependent()));
  });

  it('another user and admin CANNOT create under the guardian', async () => {
    await assertFails(setDoc(depRef(asRole(env, OTHER_UID, 'user')), validDependent()));
    await assertFails(setDoc(depRef(asRole(env, 'uAdmin', 'admin')), validDependent()));
  });
});

describe('dependents update and delete', () => {
  beforeEach(async () => {
    await seedUser(env, USER_UID, 'user');
    await seedProfile(env, USER_UID);
    await seedDependent();
  });

  it('guardian can change name and birth year', async () => {
    await assertSucceeds(updateDoc(depRef(asRole(env, USER_UID, 'user')), {
      firstName: 'Samuel', birthYear: YEAR - 13, updatedAt: serverTimestamp(),
    }));
  });

  it('rejects a createdAt change and an out-of-range birth year', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(updateDoc(depRef(db), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(depRef(db), { birthYear: YEAR - 30, updatedAt: serverTimestamp() }));
  });

  it('another user CANNOT update or delete', async () => {
    const db = asRole(env, OTHER_UID, 'user');
    await assertFails(updateDoc(depRef(db), { firstName: 'X', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(depRef(db)));
  });

  it('guardian can delete', async () => {
    await assertSucceeds(deleteDoc(depRef(asRole(env, USER_UID, 'user'))));
  });
});
