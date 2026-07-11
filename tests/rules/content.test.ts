/**
 * Firestore rules: config/banner and announcements/{docId}.
 *
 * Both are public-read; owner+admin write. Announcements support delete;
 * config is create/update only (banner config is permanent). Only the
 * banner doc is matched — any other /config/* doc is implicit-deny for
 * every role, including owner (F-53).
 */

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { asAnon, asRole, seed, setupTestEnv } from './_helpers.js';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupTestEnv(); });
beforeEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });

describe('config/banner', () => {
  beforeEach(async () => {
    await seed(env, async (db) => {
      await setDoc(doc(db, 'config', 'banner'), { message: 'hello' });
      await setDoc(doc(db, 'config', 'other'), { secret: 'not-public' });
    });
  });

  it('anyone can read the banner (public config doc)', async () => {
    await assertSucceeds(getDoc(doc(asAnon(env), 'config', 'banner')));
    await assertSucceeds(getDoc(doc(asRole(env, 'u', 'user'), 'config', 'banner')));
  });

  it('user CANNOT write the banner', async () => {
    const db = asRole(env, 'u', 'user');
    await assertFails(updateDoc(doc(db, 'config', 'banner'), { message: 'x' }));
  });

  it('admin can create + update the banner', async () => {
    const db = asRole(env, 'a', 'admin');
    // Both create and update are gated by `isOwnerOrAdmin()`. setDoc against a
    // missing doc creates; against an existing doc updates. Either path is
    // valid here.
    await assertSucceeds(setDoc(doc(db, 'config', 'banner'), { message: 'updated' }));
  });

  it('owner CANNOT delete the banner (rule is create+update only)', async () => {
    const db = asRole(env, 'o', 'owner');
    await assertFails(deleteDoc(doc(db, 'config', 'banner')));
  });

  it('non-banner config docs are unreadable — anon and signed-in (implicit deny, F-53)', async () => {
    await assertFails(getDoc(doc(asAnon(env), 'config', 'other')));
    await assertFails(getDoc(doc(asRole(env, 'u', 'user'), 'config', 'other')));
  });

  it('non-banner config docs are unwritable even for owner/admin (implicit deny, F-53)', async () => {
    await assertFails(setDoc(doc(asRole(env, 'a', 'admin'), 'config', 'new-doc'), { x: 1 }));
    await assertFails(setDoc(doc(asRole(env, 'o', 'owner'), 'config', 'other'), { secret: 'x' }));
  });
});

describe('announcements/{docId}', () => {
  beforeEach(async () => {
    await seed(env, async (db) => {
      await setDoc(doc(db, 'announcements', 'a1'), { title: 'hi' });
    });
  });

  it('anyone can read announcements', async () => {
    await assertSucceeds(getDoc(doc(asAnon(env), 'announcements', 'a1')));
  });

  it('user CANNOT write announcements', async () => {
    const db = asRole(env, 'u', 'user');
    await assertFails(updateDoc(doc(db, 'announcements', 'a1'), { title: 'x' }));
    await assertFails(deleteDoc(doc(db, 'announcements', 'a1')));
  });

  it('admin + owner can full-CRUD announcements', async () => {
    const adb = asRole(env, 'a', 'admin');
    const odb = asRole(env, 'o', 'owner');
    await assertSucceeds(setDoc(doc(adb, 'announcements', 'a2'), { title: 'b' }));
    // setDoc tests the same `create, update, delete` rule as updateDoc.
    await assertSucceeds(setDoc(doc(adb, 'announcements', 'a2'), { title: 'edit' }));
    await assertSucceeds(deleteDoc(doc(odb, 'announcements', 'a2')));
  });
});
