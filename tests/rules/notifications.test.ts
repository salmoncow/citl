/**
 * Firestore rules: email notifications (spec 011)
 *
 * notificationSettings {self read/write, key and type checks, no delete};
 * mail, notifications, config/mailDigest {no client access}.
 */

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { asAnon, asRole, seed, seedUser, setupTestEnv } from './_helpers.js';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupTestEnv(); });
beforeEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });

const MEMBER = 'uMember';
const OTHER = 'uOther';

const settings = (topics: Record<string, unknown>) => ({ topics, updatedAt: serverTimestamp() });

describe('notificationSettings', () => {
  beforeEach(async () => {
    await seedUser(env, MEMBER, 'user');
  });

  it('self can create, update, and read', async () => {
    const db = asRole(env, MEMBER, 'user');
    const ref = doc(db, 'notificationSettings', MEMBER);
    await assertSucceeds(setDoc(ref, settings({ news: true, scores: true, schedule: false })));
    await assertSucceeds(setDoc(ref, settings({ news: false })));
    await assertSucceeds(getDoc(ref));
  });

  it('another member, an admin, and anon cannot read or write', async () => {
    await seed(env, async (db) => {
      await setDoc(doc(db, 'notificationSettings', MEMBER), { topics: { news: true }, updatedAt: Timestamp.now() });
    });
    for (const db of [asRole(env, OTHER, 'user'), asRole(env, 'uAdmin', 'admin'), asAnon(env)]) {
      await assertFails(getDoc(doc(db, 'notificationSettings', MEMBER)));
      await assertFails(setDoc(doc(db, 'notificationSettings', MEMBER), settings({ news: false })));
    }
  });

  it('rejects unknown keys, unknown topics, non-boolean topics, and a client updatedAt', async () => {
    const ref = doc(asRole(env, MEMBER, 'user'), 'notificationSettings', MEMBER);
    await assertFails(setDoc(ref, { ...settings({ news: true }), email: 'x@example.com' }));
    await assertFails(setDoc(ref, settings({ newsletter: true })));
    await assertFails(setDoc(ref, settings({ news: 'yes' })));
    await assertFails(setDoc(ref, { topics: { news: true }, updatedAt: Timestamp.fromMillis(0) }));
    await assertFails(setDoc(ref, { topics: { news: true } }));
  });

  it('denies a deactivated member and delete', async () => {
    const ref = doc(asRole(env, MEMBER, 'user'), 'notificationSettings', MEMBER);
    await assertSucceeds(setDoc(ref, settings({ news: true })));
    await assertFails(deleteDoc(ref));
    await seedUser(env, MEMBER, 'user', { status: 'deactivated' });
    await assertFails(setDoc(ref, settings({ news: false })));
  });
});

describe('server-only mail collections', () => {
  it('denies every client read and write', async () => {
    const paths = ['mail/m1', 'notifications/news_a1', 'config/mailDigest'];
    await seed(env, async (db) => {
      for (const p of paths) await setDoc(doc(db, p), { x: 1 });
    });
    for (const db of [asRole(env, 'uOwner', 'owner'), asRole(env, MEMBER, 'user'), asAnon(env)]) {
      for (const p of paths) {
        await assertFails(getDoc(doc(db, p)));
        await assertFails(setDoc(doc(db, p), { x: 2 }));
      }
    }
  });
});
