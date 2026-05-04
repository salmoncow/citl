/**
 * Function unit tests for setUserRole callable.
 * Run via: firebase emulators:exec --only auth,firestore,functions
 *          'vitest run --config tests/functions/vitest.config.ts'
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import functionsTest from 'firebase-functions-test';
import {
  adminAuth,
  adminDb,
  clearAuth,
  clearFirestore,
  loadSetUserRole,
  seedUser,
} from './_helpers.js';

const fft = functionsTest({ projectId: process.env['GCLOUD_PROJECT'] ?? 'citl-fn-test' });
let setUserRoleFn: Awaited<ReturnType<typeof loadSetUserRole>>;
let wrapped: ReturnType<typeof fft.wrap>;

const OWNER = 'uOwner';
const ADMIN = 'uAdmin';
const USER = 'uUser';

beforeAll(async () => {
  setUserRoleFn = await loadSetUserRole();
  wrapped = fft.wrap(setUserRoleFn);
});

afterAll(() => {
  fft.cleanup();
});

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
  await seedUser(OWNER, 'owner');
  await seedUser(ADMIN, 'admin');
  await seedUser(USER, 'user');
});

function call(args: { actorUid: string | null; actorRole?: string; data: unknown }) {
  const auth = args.actorUid
    ? { uid: args.actorUid, token: { role: args.actorRole, sub: args.actorUid, aud: 'citl-fn-test' } as any }
    : undefined;
  return wrapped({ data: args.data, auth } as any);
}

describe('auth gate', () => {
  it('rejects unauthenticated calls with permission-denied', async () => {
    await expect(call({ actorUid: null, data: { targetUid: USER, role: 'admin' } }))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects user role with permission-denied', async () => {
    await expect(call({ actorUid: USER, actorRole: 'user', data: { targetUid: ADMIN, role: 'user' } }))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects admin role with permission-denied', async () => {
    await expect(call({ actorUid: ADMIN, actorRole: 'admin', data: { targetUid: USER, role: 'admin' } }))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });
});

describe('input validation', () => {
  it('rejects unknown role with invalid-argument', async () => {
    await expect(call({
      actorUid: OWNER, actorRole: 'owner',
      data: { targetUid: USER, role: 'superuser' },
    })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects missing targetUid with invalid-argument', async () => {
    await expect(call({
      actorUid: OWNER, actorRole: 'owner',
      data: { role: 'admin' },
    })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects empty targetUid with invalid-argument', async () => {
    await expect(call({
      actorUid: OWNER, actorRole: 'owner',
      data: { targetUid: '', role: 'admin' },
    })).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

describe('happy path', () => {
  it('promotes a user to admin: claim + mirror + audit all updated', async () => {
    const result = await call({
      actorUid: OWNER, actorRole: 'owner',
      data: { targetUid: USER, role: 'admin' },
    }) as { ok: true; fromRole: string; toRole: string };

    expect(result).toEqual({ ok: true, fromRole: 'user', toRole: 'admin' });

    const refreshed = await adminAuth().getUser(USER);
    expect(refreshed.customClaims?.['role']).toBe('admin');

    const mirror = await adminDb().doc(`users/${USER}`).get();
    expect(mirror.data()?.['role']).toBe('admin');
    expect(mirror.data()?.['roleChangedAt']).toBeDefined();

    const audit = await adminDb().collection('audit').get();
    expect(audit.size).toBe(1);
    const entry = audit.docs[0]!.data();
    expect(entry['actorUid']).toBe(OWNER);
    expect(entry['targetUid']).toBe(USER);
    expect(entry['fromRole']).toBe('user');
    expect(entry['toRole']).toBe('admin');
  });

  it('demotes admin back to user', async () => {
    const result = await call({
      actorUid: OWNER, actorRole: 'owner',
      data: { targetUid: ADMIN, role: 'user' },
    }) as { ok: true; fromRole: string; toRole: string };
    expect(result.fromRole).toBe('admin');
    expect(result.toRole).toBe('user');
  });
});

describe('last-owner guard', () => {
  it('refuses to demote the only owner', async () => {
    await expect(call({
      actorUid: OWNER, actorRole: 'owner',
      data: { targetUid: OWNER, role: 'user' },
    })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('allows demoting an owner when another owner exists', async () => {
    const SECOND_OWNER = 'uOwner2';
    await seedUser(SECOND_OWNER, 'owner');
    const result = await call({
      actorUid: OWNER, actorRole: 'owner',
      data: { targetUid: SECOND_OWNER, role: 'user' },
    }) as { ok: true; fromRole: string; toRole: string };
    expect(result.toRole).toBe('user');
  });
});

describe('rate limit', () => {
  it('returns resource-exhausted on the 21st call within an hour', async () => {
    // Seed counter at LIMIT to short-circuit the test (no need to make 20 actual calls)
    await adminDb()
      .doc(`rateLimits/setUserRole/actors/${OWNER}`)
      .set({ windowStart: Date.now(), count: 20 });

    await expect(call({
      actorUid: OWNER, actorRole: 'owner',
      data: { targetUid: USER, role: 'admin' },
    })).rejects.toMatchObject({ code: 'resource-exhausted' });
  });

  it('resets the window when windowStart is older than 1 hour', async () => {
    await adminDb()
      .doc(`rateLimits/setUserRole/actors/${OWNER}`)
      .set({ windowStart: Date.now() - 2 * 60 * 60 * 1000, count: 20 });

    const result = await call({
      actorUid: OWNER, actorRole: 'owner',
      data: { targetUid: USER, role: 'admin' },
    }) as { ok: true };
    expect(result.ok).toBe(true);
  });
});

describe('not-found', () => {
  it('returns not-found when target user doc does not exist', async () => {
    await expect(call({
      actorUid: OWNER, actorRole: 'owner',
      data: { targetUid: 'nonexistent-uid', role: 'admin' },
    })).rejects.toMatchObject({ code: 'not-found' });
  });
});
