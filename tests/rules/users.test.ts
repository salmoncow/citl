/**
 * Firestore rules: users/{uid}
 *
 * Matrix: {owner, admin, user, anon} × {read self, read other, create
 * (denied for all clients — onUserCreate seeds server-side), update
 * timestamps (the only allowed self-write), update identity fields
 * (must deny — client-mutable identity enables impersonation in the
 * admin Users tab), update role (must deny for every role since it
 * would let clients self-promote), delete}.
 */

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { asAnon, asNoRole, asRole, seed, seedUser, setupTestEnv } from './_helpers.js';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await setupTestEnv();
});

beforeEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env.cleanup();
});

const OWNER_UID = 'uOwner';
const ADMIN_UID = 'uAdmin';
const USER_UID = 'uUser';
const OTHER_UID = 'uOther';

describe('users/{uid} read', () => {
  beforeEach(async () => {
    await seedUser(env, OWNER_UID, 'owner');
    await seedUser(env, ADMIN_UID, 'admin');
    await seedUser(env, USER_UID, 'user');
    await seedUser(env, OTHER_UID, 'user');
  });

  it('owner can read any user doc', async () => {
    const db = asRole(env, OWNER_UID, 'owner');
    await assertSucceeds(getDoc(doc(db, 'users', USER_UID)));
    await assertSucceeds(getDoc(doc(db, 'users', OTHER_UID)));
  });

  it('admin can read any user doc', async () => {
    const db = asRole(env, ADMIN_UID, 'admin');
    await assertSucceeds(getDoc(doc(db, 'users', USER_UID)));
    await assertSucceeds(getDoc(doc(db, 'users', OWNER_UID)));
  });

  it('user can read only their own doc', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertSucceeds(getDoc(doc(db, 'users', USER_UID)));
    await assertFails(getDoc(doc(db, 'users', OTHER_UID)));
  });

  it('anon cannot read any user doc', async () => {
    const db = asAnon(env);
    await assertFails(getDoc(doc(db, 'users', USER_UID)));
    await assertFails(getDoc(doc(db, 'users', OWNER_UID)));
  });
});

describe('users/{uid} create (denied for all clients — onUserCreate seeds server-side)', () => {
  it('user CANNOT create own doc even without role field', async () => {
    const db = asNoRole(env, USER_UID);
    await assertFails(
      setDoc(doc(db, 'users', USER_UID), {
        uid: USER_UID,
        email: 'u@example.com',
        displayName: 'U',
        photoURL: null,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('user CANNOT create own doc with role field — even role: user', async () => {
    const db = asNoRole(env, USER_UID);
    await assertFails(
      setDoc(doc(db, 'users', USER_UID), {
        uid: USER_UID,
        role: 'user',
      }),
    );
  });

  it('user CANNOT create another user\'s doc', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(
      setDoc(doc(db, 'users', OTHER_UID), {
        uid: OTHER_UID,
      }),
    );
  });

  it('anon cannot create any user doc', async () => {
    const db = asAnon(env);
    await assertFails(
      setDoc(doc(db, 'users', USER_UID), { uid: USER_UID }),
    );
  });
});

describe('users/{uid} update — timestamps only; identity fields locked', () => {
  beforeEach(async () => {
    await seedUser(env, USER_UID, 'user');
    await seedUser(env, OTHER_UID, 'user');
  });

  it('user CANNOT update own displayName (impersonation guard)', async () => {
    // The Users tab renders displayName/email as row identity when the
    // owner grants roles; a self-writable mirror lets any account mimic
    // a known league member.
    const db = asRole(env, USER_UID, 'user');
    await assertFails(
      updateDoc(doc(db, 'users', USER_UID), { displayName: 'New Name' }),
    );
  });

  it('user CANNOT update own email mirror', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(
      updateDoc(doc(db, 'users', USER_UID), { email: 'spoof@example.com' }),
    );
  });

  it('user CANNOT smuggle identity fields alongside allowed timestamps', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(
      updateDoc(doc(db, 'users', USER_UID), {
        lastSignInAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        displayName: 'Sneaky',
      }),
    );
  });

  it('user can self-update lastSignInAt + updatedAt (touchLastSignIn path)', async () => {
    // Exercises the rules path that AuthModule.touchLastSignIn relies on:
    // self-update of timestamp fields with no role field present.
    const db = asRole(env, USER_UID, 'user');
    await assertSucceeds(
      updateDoc(doc(db, 'users', USER_UID), {
        lastSignInAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('user CANNOT update another user\'s doc', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(
      updateDoc(doc(db, 'users', OTHER_UID), { displayName: 'Hacked' }),
    );
  });

  it('admin CANNOT update another user\'s doc — even non-role fields', async () => {
    // Rules say update requires isSelf(uid). Admin has read but not write
    // on others (server-side mutations go through the callable, never the
    // client SDK).
    const db = asRole(env, ADMIN_UID, 'admin');
    await assertFails(
      updateDoc(doc(db, 'users', USER_UID), { displayName: 'AdminEdit' }),
    );
  });

  it('owner CANNOT update another user\'s doc directly', async () => {
    // Same reasoning: ownership of role writes belongs to the callable.
    const db = asRole(env, OWNER_UID, 'owner');
    await assertFails(
      updateDoc(doc(db, 'users', USER_UID), { displayName: 'OwnerEdit' }),
    );
  });
});

describe('users/{uid} update — role field (the security boundary)', () => {
  beforeEach(async () => {
    await seedUser(env, OWNER_UID, 'owner');
    await seedUser(env, ADMIN_UID, 'admin');
    await seedUser(env, USER_UID, 'user');
  });

  it('user CANNOT change own role to admin', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(
      updateDoc(doc(db, 'users', USER_UID), { role: 'admin' }),
    );
  });

  it('user CANNOT change own role to owner', async () => {
    const db = asRole(env, USER_UID, 'user');
    await assertFails(
      updateDoc(doc(db, 'users', USER_UID), { role: 'owner' }),
    );
  });

  it('admin CANNOT change own role to owner', async () => {
    const db = asRole(env, ADMIN_UID, 'admin');
    await assertFails(
      updateDoc(doc(db, 'users', ADMIN_UID), { role: 'owner' }),
    );
  });

  it('owner CANNOT change own role via direct write (must use callable)', async () => {
    const db = asRole(env, OWNER_UID, 'owner');
    await assertFails(
      updateDoc(doc(db, 'users', OWNER_UID), { role: 'admin' }),
    );
  });

  it('owner CANNOT change another user\'s role via direct write', async () => {
    const db = asRole(env, OWNER_UID, 'owner');
    await assertFails(
      updateDoc(doc(db, 'users', USER_UID), { role: 'admin' }),
    );
  });
});

describe('users/{uid} delete', () => {
  beforeEach(async () => {
    await seedUser(env, USER_UID, 'user');
  });

  it('no role can delete a user doc', async () => {
    await assertFails(deleteDoc(doc(asRole(env, OWNER_UID, 'owner'), 'users', USER_UID)));
    await seed(env, async (db) => { await setDoc(doc(db, 'users', USER_UID), { role: 'user' }); });
    await assertFails(deleteDoc(doc(asRole(env, ADMIN_UID, 'admin'), 'users', USER_UID)));
    await seed(env, async (db) => { await setDoc(doc(db, 'users', USER_UID), { role: 'user' }); });
    await assertFails(deleteDoc(doc(asRole(env, USER_UID, 'user'), 'users', USER_UID)));
    await seed(env, async (db) => { await setDoc(doc(db, 'users', USER_UID), { role: 'user' }); });
    await assertFails(deleteDoc(doc(asAnon(env), 'users', USER_UID)));
  });
});
