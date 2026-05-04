/**
 * Firestore rules: config/{doc} and announcements/{docId}.
 *
 * Both are public-read; owner+admin write. Announcements support delete;
 * config is create/update only (banner config is permanent).
 */

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { asAnon, asRole, seed, setupTestEnv } from './_helpers.js';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupTestEnv(); });
beforeEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });

describe('config/{doc}', () => {
  beforeEach(async () => {
    await seed(env, async (db) => {
      await setDoc(doc(db, 'config', 'banner'), { message: 'hello' });
    });
  });

  it('anyone can read config (public banner)', async () => {
    await assertSucceeds(getDoc(doc(asAnon(env), 'config', 'banner')));
    await assertSucceeds(getDoc(doc(asRole(env, 'u', 'user'), 'config', 'banner')));
  });

  it('user CANNOT write config', async () => {
    const db = asRole(env, 'u', 'user');
    await assertFails(updateDoc(doc(db, 'config', 'banner'), { message: 'x' }));
  });

  it('admin can create + update config', async () => {
    const db = asRole(env, 'a', 'admin');
    // Both create and update are gated by `isOwnerOrAdmin()`. setDoc against a
    // missing doc creates; against an existing doc updates. Either path is
    // valid here.
    await assertSucceeds(setDoc(doc(db, 'config', 'new-doc'), { x: 1 }));
    await assertSucceeds(setDoc(doc(db, 'config', 'banner'), { message: 'updated' }));
  });

  it('owner CANNOT delete config (rule is create+update only)', async () => {
    const db = asRole(env, 'o', 'owner');
    await assertFails(deleteDoc(doc(db, 'config', 'banner')));
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
