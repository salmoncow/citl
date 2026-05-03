/**
 * Firestore rules: audit/{id}
 *
 * Read by owner only; writes denied for everyone (Admin SDK only via the
 * setUserRole callable / set-role.js CLI).
 */

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { asAnon, asRole, seed, setupTestEnv } from './_helpers.js';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupTestEnv(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, async (db) => {
    await setDoc(doc(db, 'audit', 'a1'), {
      actorUid: 'cli',
      targetUid: 'u',
      fromRole: 'user',
      toRole: 'admin',
      at: new Date(),
    });
  });
});
afterAll(async () => { await env.cleanup(); });

it('owner can read audit entries', async () => {
  await assertSucceeds(getDoc(doc(asRole(env, 'o', 'owner'), 'audit', 'a1')));
});

it('admin CANNOT read audit entries', async () => {
  await assertFails(getDoc(doc(asRole(env, 'a', 'admin'), 'audit', 'a1')));
});

it('user CANNOT read audit entries', async () => {
  await assertFails(getDoc(doc(asRole(env, 'u', 'user'), 'audit', 'a1')));
});

it('anon CANNOT read audit entries', async () => {
  await assertFails(getDoc(doc(asAnon(env), 'audit', 'a1')));
});

it('no role can write to audit (Admin SDK only)', async () => {
  await assertFails(setDoc(doc(asRole(env, 'o', 'owner'), 'audit', 'new'), { x: 1 }));
  await assertFails(setDoc(doc(asRole(env, 'a', 'admin'), 'audit', 'new'), { x: 1 }));
  await assertFails(setDoc(doc(asRole(env, 'u', 'user'), 'audit', 'new'), { x: 1 }));
});
