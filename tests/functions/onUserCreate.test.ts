/**
 * Function unit tests for the onUserCreate auth trigger handler.
 *
 * Each test uses a unique uid so we don't need to clear emulator state
 * between tests — sidesteps fragile clearAuth/clearFirestore behavior.
 */

import { beforeAll, expect, it } from 'vitest';
import { adminAuth, adminDb, loadHandleUserCreated } from './_helpers.js';

let handleUserCreated: Awaited<ReturnType<typeof loadHandleUserCreated>>;

beforeAll(async () => {
  handleUserCreated = await loadHandleUserCreated();
});

let counter = 0;
const newUid = (): string => `ouc-${Date.now()}-${++counter}`;

it('is idempotent — does not overwrite an existing users/{uid} doc', async () => {
  const uid = newUid();
  await adminAuth().createUser({ uid, email: `${uid}@example.com` });
  await adminDb().doc(`users/${uid}`).set({
    uid, role: 'admin', email: `${uid}@example.com`, displayName: 'Existing',
  });

  await handleUserCreated({ uid, email: `${uid}@example.com` });

  const mirror = (await adminDb().doc(`users/${uid}`).get()).data();
  expect(mirror?.['role']).toBe('admin');
});

it('handles missing email/displayName/photoURL gracefully', async () => {
  const uid = newUid();
  await adminAuth().createUser({ uid });
  await handleUserCreated({ uid });

  const mirror = (await adminDb().doc(`users/${uid}`).get()).data();
  expect(mirror?.['role']).toBe('user');
  expect(mirror?.['email']).toBeNull();
  expect(mirror?.['displayName']).toBeNull();
  expect(mirror?.['photoURL']).toBeNull();
});
