/**
 * UserRepository — Firestore reads of `users/{uid}`.
 *
 * Responsibilities:
 *   - findById: single-doc fetch
 *   - listPaginated: cursor-paginated list ordered by createdAt desc
 *     (per constitution §III.3 / §IV.2 — never unbounded reads)
 *   - observeSelf: real-time listener on the current user's doc, used
 *     to detect roleChangedAt bumps and force token refresh
 *   - touchLastSignIn: self-update of lastSignInAt on each session
 *     start (skipped on first sign-in to let onUserCreate seed the doc
 *     with role + custom claims).
 *
 * Never writes identity or role fields. Firestore rules restrict client
 * self-update to lastSignInAt/updatedAt (the touchLastSignIn path).
 *
 * Error convention: unlike ScoreRepository's Result contract, methods here
 * deliberately throw (or reject) on Firestore errors. Callers are the
 * admin-only Users tab and the auth module, which already wrap calls in
 * try/catch and surface failures directly; the exceptions are
 * touchLastSignIn (best-effort, swallows + warns internally) and
 * observeSelf (errors delivered via the snapshot listener).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  type DocumentSnapshot,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type { UserDoc } from '@/types/user';

export interface ListPage {
  users: UserDoc[];
  nextCursor: DocumentSnapshot | null;
}

export class UserRepository {
  constructor(private readonly db: Firestore) {}

  async findById(uid: string): Promise<UserDoc | null> {
    const snap = await getDoc(doc(this.db, 'users', uid));
    return snap.exists() ? (snap.data() as UserDoc) : null;
  }

  async listPaginated(opts: { pageSize?: number; cursor?: DocumentSnapshot | null } = {}): Promise<ListPage> {
    const pageSize = opts.pageSize ?? 20;
    const baseConstraints = [orderBy('createdAt', 'desc'), limit(pageSize)];
    const q = opts.cursor
      ? query(collection(this.db, 'users'), orderBy('createdAt', 'desc'), startAfter(opts.cursor), limit(pageSize))
      : query(collection(this.db, 'users'), ...baseConstraints);

    const snap = await getDocs(q);
    const users = snap.docs.map((d) => d.data() as UserDoc);
    const nextCursor = snap.docs.length === pageSize ? (snap.docs[snap.docs.length - 1] ?? null) : null;
    return { users, nextCursor };
  }

  /**
   * Subscribe to changes on the given user's mirror doc. Caller must
   * invoke the returned Unsubscribe on sign-out / teardown to avoid
   * leaking listeners.
   */
  observeSelf(uid: string, cb: (doc: UserDoc | null) => void): Unsubscribe {
    return onSnapshot(doc(this.db, 'users', uid), (snap) => {
      cb(snap.exists() ? (snap.data() as UserDoc) : null);
    });
  }

  /**
   * Update lastSignInAt on the user's mirror doc. Skipped if the doc
   * doesn't exist yet — onUserCreate races with this on first sign-in
   * and is idempotent (no-ops if the doc already exists), so beating
   * it would cause role + custom claims to never be written.
   *
   * Errors are swallowed: sign-in must never fail because of a mirror
   * update.
   */
  async touchLastSignIn(uid: string): Promise<void> {
    try {
      const ref = doc(this.db, 'users', uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      await updateDoc(ref, {
        lastSignInAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('[user-repository] touchLastSignIn failed:', e);
    }
  }
}
