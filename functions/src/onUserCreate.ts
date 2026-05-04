/**
 * onUserCreate — Firebase Auth trigger that seeds a users/{uid} doc and
 * sets `role: 'user'` custom claim on first sign-in.
 *
 * Idempotent: if users/{uid} already exists, the trigger no-ops. This
 * matters because (a) the trigger may be re-delivered, and (b) the
 * bootstrap CLI may seed an owner before the trigger fires for the
 * very first user.
 *
 * Uses the v1 API (auth.user().onCreate) so the trigger runs
 * asynchronously after sign-in completes — keeps sign-in latency low.
 * v2 only offers blocking (`beforeUserCreated`) which we don't need.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { auth } from 'firebase-functions/v1';
import type { UserRecord } from 'firebase-admin/auth';

if (getApps().length === 0) {
  initializeApp();
}

/**
 * Handler is exported so tests can call it directly without
 * firebase-functions-test's wrap (which has known issues with v1 auth
 * triggers swallowing post-await side effects).
 */
export async function handleUserCreated(user: UserRecord | { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null }): Promise<void> {
  const db = getFirestore();
  const adminAuth = getAuth();

  const userRef = db.doc(`users/${user.uid}`);
  const existing = await userRef.get();
  if (existing.exists) {
    return;
  }

  await adminAuth.setCustomUserClaims(user.uid, { role: 'user' });

  await userRef.set({
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    role: 'user',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastSignInAt: FieldValue.serverTimestamp(),
  });
}

export const onUserCreate = auth.user().onCreate(handleUserCreated);
