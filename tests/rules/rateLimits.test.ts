/**
 * Firestore rules: rateLimits/** counters used by setUserRole.
 *
 * Read by owner only; no client writes (Function-internal counter).
 */

import { afterAll, beforeAll, beforeEach, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { asAnon, asRole, seed, setupTestEnv } from './_helpers.js';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupTestEnv(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, async (db) => {
    await setDoc(doc(db, 'rateLimits', 'setUserRole', 'actors', 'uOwner'), {
      windowStart: new Date(),
      count: 5,
    });
  });
});
afterAll(async () => { await env.cleanup(); });

it('owner can read rate-limit counters', async () => {
  await assertSucceeds(
    getDoc(doc(asRole(env, 'o', 'owner'), 'rateLimits', 'setUserRole', 'actors', 'uOwner')),
  );
});

it('admin CANNOT read rate-limit counters', async () => {
  await assertFails(
    getDoc(doc(asRole(env, 'a', 'admin'), 'rateLimits', 'setUserRole', 'actors', 'uOwner')),
  );
});

it('anon CANNOT read rate-limit counters', async () => {
  await assertFails(
    getDoc(doc(asAnon(env), 'rateLimits', 'setUserRole', 'actors', 'uOwner')),
  );
});

it('no role can write rate-limit counters', async () => {
  await assertFails(
    setDoc(doc(asRole(env, 'o', 'owner'), 'rateLimits', 'setUserRole', 'actors', 'x'), { count: 1 }),
  );
  await assertFails(
    setDoc(doc(asRole(env, 'a', 'admin'), 'rateLimits', 'setUserRole', 'actors', 'x'), { count: 1 }),
  );
  await assertFails(
    setDoc(doc(asRole(env, 'u', 'user'), 'rateLimits', 'setUserRole', 'actors', 'x'), { count: 1 }),
  );
});
