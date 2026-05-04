/**
 * UserRepository — Firestore reads of `users/{uid}`.
 *
 * Responsibilities:
 *   - findById: single-doc fetch
 *   - listPaginated: cursor-paginated list ordered by createdAt desc
 *     (per constitution §III.3 / §IV.2 — never unbounded reads)
 *   - observeSelf: real-time listener on the current user's doc, used
 *     to detect roleChangedAt bumps and force token refresh
 *
 * Never writes the `role` field. Self-update of non-role fields is
 * permitted by rules but currently unused — clients should not write
 * the mirror outside the server-managed flow.
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
  startAfter,
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
}
