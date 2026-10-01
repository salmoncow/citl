/**
 * Helpers for function unit tests.
 *
 * IMPORTANT: env vars are set in _setup.ts (vitest setupFile) which runs
 * before this module is loaded. Initializes the Admin SDK once, exposes
 * helpers for seeding + clearing emulator state, and lazy-imports the
 * function modules so environment-gated decisions (enforceAppCheck) are
 * captured correctly.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({ projectId: process.env['GCLOUD_PROJECT'] ?? 'citl-fn-test' });
}

export const adminAuth = () => getAuth();
export const adminDb = () => getFirestore();

const PROJECT = process.env['GCLOUD_PROJECT'] ?? 'citl-fn-test';
const FIRESTORE_HOST = process.env['FIRESTORE_EMULATOR_HOST'] ?? '127.0.0.1:8080';

export async function clearFirestore(): Promise<void> {
  const url = `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`clearFirestore failed: ${res.status} ${res.statusText}`);
}

export async function clearAuth(): Promise<void> {
  // Use Admin SDK rather than the emulator REST endpoint — REST is flaky
  // for repeated DELETE calls and sometimes leaves stale state.
  const result = await adminAuth().listUsers(1000);
  const uids = result.users.map((u) => u.uid);
  if (uids.length > 0) {
    await adminAuth().deleteUsers(uids);
  }
}

export async function seedUser(
  uid: string,
  role: 'owner' | 'admin' | 'user',
  extras: Record<string, unknown> = {},
): Promise<void> {
  await adminAuth().createUser({ uid, email: `${uid}@example.com`, displayName: uid });
  await adminAuth().setCustomUserClaims(uid, { role });
  await adminDb().doc(`users/${uid}`).set({
    uid,
    email: `${uid}@example.com`,
    displayName: uid,
    photoURL: null,
    role,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastSignInAt: FieldValue.serverTimestamp(),
    ...extras,
  });
}

/**
 * Lazy-load the function module after env vars are set, so the module's
 * top-level `enforceAppCheck: !isEmulator` reads the right value.
 */
export async function loadSetUserRole() {
  const mod = await import('../../functions/src/setUserRole.js');
  return mod.setUserRole;
}

export async function loadOnUserCreate() {
  const mod = await import('../../functions/src/onUserCreate.js');
  return mod.onUserCreate;
}

export async function loadHandleUserCreated() {
  const mod = await import('../../functions/src/onUserCreate.js');
  return mod.handleUserCreated;
}

export async function loadSetAccountStatus() {
  return import('../../functions/src/setAccountStatus.js');
}

export async function loadDeleteAccount() {
  return import('../../functions/src/deleteAccount.js');
}

/**
 * Hand-built partial CallableRequest. The real types carry a dozen
 * required fields irrelevant to these tests.
 */
export function callableRequest(args: {
  uid: string | null;
  role?: string;
  authTime?: number;
  data: unknown;
}) {
  const auth = args.uid
    ? {
        uid: args.uid,
        token: {
          role: args.role,
          sub: args.uid,
          aud: 'citl-fn-test',
          auth_time: args.authTime ?? Math.floor(Date.now() / 1000),
        },
      }
    : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { data: args.data, auth } as any;
}
