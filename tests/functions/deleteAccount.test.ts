/**
 * Function unit tests for the deleteAccount callable (spec 008).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import functionsTest from 'firebase-functions-test';
import {
  adminAuth,
  adminDb,
  callableRequest,
  clearAuth,
  clearFirestore,
  loadDeleteAccount,
  seedUser,
} from './_helpers.js';

const fft = functionsTest({ projectId: process.env['GCLOUD_PROJECT'] ?? 'citl-fn-test' });
let mod: Awaited<ReturnType<typeof loadDeleteAccount>>;
let wrapped: ReturnType<typeof fft.wrap>;

const OWNER = 'uOwner';
const ADMIN = 'uAdmin';
const USER = 'uUser';
const OTHER = 'uOther';

const nowSec = () => Math.floor(Date.now() / 1000);

beforeAll(async () => {
  mod = await loadDeleteAccount();
  wrapped = fft.wrap(mod.deleteAccount);
});

afterAll(() => {
  fft.cleanup();
});

async function seedProfile(uid: string): Promise<void> {
  await adminDb().doc(`profiles/${uid}`).set({
    displayName: `Name ${uid}`,
    termsVersion: '2026-10',
    adultAttested: true,
  });
}

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
  await seedUser(OWNER, 'owner');
  await seedUser(ADMIN, 'admin');
  await seedUser(USER, 'user', { status: 'active' });
  await seedUser(OTHER, 'user');
  await seedProfile(USER);
  await seedProfile(OTHER);
  await adminDb().doc(`profiles/${USER}/dependents/d1`).set({ firstName: 'Kid' });
  await adminDb().doc(`notificationSettings/${USER}`).set({ weekly: true });
});

function call(uid: string | null, role: string | undefined, data: unknown, authTime?: number) {
  return wrapped(callableRequest({ uid, role, data, authTime }));
}

async function exists(path: string): Promise<boolean> {
  return (await adminDb().doc(path).get()).exists;
}

describe('rejections', () => {
  it('rejects unauthenticated calls', async () => {
    await expect(call(null, undefined, { confirm: 'DELETE' }))
      .rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rejects a missing or wrong confirm with invalid-argument', async () => {
    await expect(call(USER, 'user', {})).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(call(USER, 'user', { confirm: 'delete' }))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects a stale sign-in with requires-recent-login', async () => {
    await expect(call(USER, 'user', { confirm: 'DELETE' }, nowSec() - 301))
      .rejects.toMatchObject({
        code: 'failed-precondition',
        details: { reason: 'requires-recent-login' },
      });
    expect(await exists(`users/${USER}`)).toBe(true);
  });

  it('rejects owner and admin callers with failed-precondition', async () => {
    await expect(call(OWNER, 'owner', { confirm: 'DELETE' }))
      .rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(call(ADMIN, 'admin', { confirm: 'DELETE' }))
      .rejects.toMatchObject({ code: 'failed-precondition' });
    expect(await exists(`users/${OWNER}`)).toBe(true);
    expect(await exists(`users/${ADMIN}`)).toBe(true);
  });

  it('a throwing captain guard stops the call before any write', async () => {
    const guard = vi.fn().mockRejectedValue(new Error('captain'));
    const handler = mod.makeDeleteAccountHandler(guard);
    await expect(handler(callableRequest({ uid: USER, role: 'user', data: { confirm: 'DELETE' } })))
      .rejects.toThrow('captain');
    expect(guard).toHaveBeenCalledWith(expect.anything(), USER);
    expect(await exists(`profiles/${USER}`)).toBe(true);
    expect(await exists(`users/${USER}`)).toBe(true);
    expect((await adminDb().collection('audit').get()).size).toBe(0);
    await expect(adminAuth().getUser(USER)).resolves.toBeTruthy();
  });
});

describe('success', () => {
  it('removes profile (with dependents), settings, mirror and Auth user, and audits once', async () => {
    await expect(call(USER, 'user', { confirm: 'DELETE' })).resolves.toEqual({ ok: true });

    await expect(adminAuth().getUser(USER)).rejects.toMatchObject({ code: 'auth/user-not-found' });
    expect(await exists(`profiles/${USER}`)).toBe(false);
    expect(await exists(`profiles/${USER}/dependents/d1`)).toBe(false);
    expect(await exists(`notificationSettings/${USER}`)).toBe(false);
    expect(await exists(`users/${USER}`)).toBe(false);

    const audit = (await adminDb().collection('audit').get()).docs.map((d) => d.data());
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      kind: 'account-status',
      actorUid: USER,
      targetUid: USER,
      fromStatus: 'active',
      toStatus: 'deleted',
    });
    expect(Object.keys(audit[0]!).sort()).toEqual(
      ['actorUid', 'at', 'fromStatus', 'kind', 'targetUid', 'toStatus'],
    );
  });

  it('a deactivated member can delete', async () => {
    await seedUser('uDeact', 'user', { status: 'deactivated' });
    await call('uDeact', 'user', { confirm: 'DELETE' });
    const audit = (await adminDb().collection('audit').get()).docs.map((d) => d.data());
    expect(audit[0]?.['fromStatus']).toBe('deactivated');
  });
});

describe('isolation', () => {
  it('leaves season docs containing the name, and other users, untouched', async () => {
    const team = adminDb().doc('seasons/2025/teams/t1');
    const week = adminDb().doc('seasons/2025/weeks/1');
    await team.set({ name: 'Team 1', shooters: [{ name: USER }] });
    await week.set({ scores: [{ name: USER, total: 24 }] });
    const before = await Promise.all([team.get(), week.get()]);

    await call(USER, 'user', { confirm: 'DELETE' });

    const after = await Promise.all([team.get(), week.get()]);
    for (let i = 0; i < before.length; i++) {
      expect(after[i]!.data()).toEqual(before[i]!.data());
      expect(after[i]!.updateTime?.isEqual(before[i]!.updateTime!)).toBe(true);
    }
    expect(await exists(`users/${OTHER}`)).toBe(true);
    expect(await exists(`profiles/${OTHER}`)).toBe(true);
    await expect(adminAuth().getUser(OTHER)).resolves.toBeTruthy();
  });
});

describe('retry', () => {
  it('succeeds when the profile is already gone', async () => {
    await adminDb().recursiveDelete(adminDb().doc(`profiles/${USER}`));
    await expect(call(USER, 'user', { confirm: 'DELETE' })).resolves.toEqual({ ok: true });
    expect(await exists(`users/${USER}`)).toBe(false);
  });

  it('succeeds when only the Auth user remains (step-4 failure)', async () => {
    await adminDb().recursiveDelete(adminDb().doc(`profiles/${USER}`));
    await adminDb().doc(`users/${USER}`).delete();
    await expect(call(USER, 'user', { confirm: 'DELETE' })).resolves.toEqual({ ok: true });
    await expect(adminAuth().getUser(USER)).rejects.toMatchObject({ code: 'auth/user-not-found' });
  });
});
