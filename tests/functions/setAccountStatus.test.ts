/**
 * Function unit tests for the setAccountStatus callable (spec 008).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import functionsTest from 'firebase-functions-test';
import {
  adminDb,
  callableRequest,
  clearAuth,
  clearFirestore,
  loadSetAccountStatus,
  seedUser,
} from './_helpers.js';

const fft = functionsTest({ projectId: process.env['GCLOUD_PROJECT'] ?? 'citl-fn-test' });
let mod: Awaited<ReturnType<typeof loadSetAccountStatus>>;
let wrapped: ReturnType<typeof fft.wrap>;

const OWNER = 'uOwner';
const ADMIN = 'uAdmin';
const USER = 'uUser';

beforeAll(async () => {
  mod = await loadSetAccountStatus();
  wrapped = fft.wrap(mod.setAccountStatus);
});

afterAll(() => {
  fft.cleanup();
});

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
  await seedUser(OWNER, 'owner');
  await seedUser(ADMIN, 'admin');
  await seedUser(USER, 'user', { status: 'active' });
});

function call(uid: string | null, role: string | undefined, data: unknown) {
  return wrapped(callableRequest({ uid, role, data }));
}

async function auditEntries() {
  return (await adminDb().collection('audit').get()).docs.map((d) => d.data());
}

describe('rejections', () => {
  it('rejects unauthenticated calls', async () => {
    await expect(call(null, undefined, { status: 'deactivated' }))
      .rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rejects an invalid status with invalid-argument', async () => {
    await expect(call(USER, 'user', { status: 'deleted' }))
      .rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(call(USER, 'user', {}))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects owner and admin callers with failed-precondition', async () => {
    await expect(call(OWNER, 'owner', { status: 'deactivated' }))
      .rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(call(ADMIN, 'admin', { status: 'deactivated' }))
      .rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('rejects a caller whose mirror says owner even if the token still says user', async () => {
    await adminDb().doc(`users/${USER}`).update({ role: 'owner' });
    await expect(call(USER, 'user', { status: 'deactivated' }))
      .rejects.toMatchObject({ code: 'failed-precondition', details: { reason: 'privileged-role' } });
    expect(await auditEntries()).toHaveLength(0);
  });

  it('returns not-found when the mirror is missing', async () => {
    await expect(call('uGhost', 'user', { status: 'deactivated' }))
      .rejects.toMatchObject({ code: 'not-found' });
  });

  it('returns resource-exhausted on the 11th call within an hour', async () => {
    await adminDb()
      .doc(`rateLimits/setAccountStatus/actors/${USER}`)
      .set({ windowStart: Date.now(), count: 10 });
    await expect(call(USER, 'user', { status: 'deactivated' }))
      .rejects.toMatchObject({ code: 'resource-exhausted' });
  });
});

describe('deactivate', () => {
  it('sets status and deactivatedAt and writes a PII-free audit entry', async () => {
    const result = await call(USER, 'user', { status: 'deactivated' });
    expect(result).toEqual({ ok: true, status: 'deactivated', changed: true });

    const mirror = (await adminDb().doc(`users/${USER}`).get()).data();
    expect(mirror?.['status']).toBe('deactivated');
    expect(mirror?.['deactivatedAt']).toBeTruthy();
    expect(mirror?.['statusChangedAt']).toBeTruthy();

    const entries = await auditEntries();
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry).toMatchObject({
      kind: 'account-status',
      actorUid: USER,
      targetUid: USER,
      fromStatus: 'active',
      toStatus: 'deactivated',
    });
    expect(Object.keys(entry).sort()).toEqual(
      ['actorUid', 'at', 'fromStatus', 'kind', 'targetUid', 'toStatus'],
    );
  });

  it('treats a missing status as active', async () => {
    await seedUser('uLegacy', 'user');
    const result = await call('uLegacy', 'user', { status: 'deactivated' });
    expect(result).toMatchObject({ changed: true });
    expect((await auditEntries())[0]?.['fromStatus']).toBe('active');
  });

  it('calls the captain guard on deactivate, before any write', async () => {
    const guard = vi.fn().mockRejectedValue(new Error('captain'));
    const handler = mod.makeSetAccountStatusHandler(guard);
    await expect(handler(callableRequest({ uid: USER, role: 'user', data: { status: 'deactivated' } })))
      .rejects.toThrow('captain');
    expect(guard).toHaveBeenCalledWith(expect.anything(), USER);
    expect((await adminDb().doc(`users/${USER}`).get()).data()?.['status']).toBe('active');
    expect(await auditEntries()).toHaveLength(0);
  });
});

describe('reactivate', () => {
  it('sets status active and clears deactivatedAt', async () => {
    await call(USER, 'user', { status: 'deactivated' });
    const result = await call(USER, 'user', { status: 'active' });
    expect(result).toEqual({ ok: true, status: 'active', changed: true });

    const mirror = (await adminDb().doc(`users/${USER}`).get()).data();
    expect(mirror?.['status']).toBe('active');
    expect(mirror?.['deactivatedAt']).toBeNull();

    const entries = await auditEntries();
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e['toStatus']).sort()).toEqual(['active', 'deactivated']);
  });

  it('does not call the captain guard on reactivate', async () => {
    await call(USER, 'user', { status: 'deactivated' });
    const guard = vi.fn().mockResolvedValue(undefined);
    const handler = mod.makeSetAccountStatusHandler(guard);
    await handler(callableRequest({ uid: USER, role: 'user', data: { status: 'active' } }));
    expect(guard).not.toHaveBeenCalled();
  });
});

describe('no-op', () => {
  it('writes nothing when the status is unchanged', async () => {
    const result = await call(USER, 'user', { status: 'active' });
    expect(result).toEqual({ ok: true, status: 'active', changed: false });
    expect(await auditEntries()).toHaveLength(0);
    const counter = await adminDb().doc(`rateLimits/setAccountStatus/actors/${USER}`).get();
    expect(counter.exists).toBe(false);
  });
});
