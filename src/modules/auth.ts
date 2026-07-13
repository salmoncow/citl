/**
 * AuthModule — Firebase Auth wrapper.
 *
 * Responsibilities:
 *   - Google sign-in/out via popup
 *   - Auth-state observation (onAuthStateChanged)
 *   - Reading the role custom claim (delegates to modules/role.ts)
 *   - Forced token refresh in response to server-driven role changes
 *
 * Role-change propagation:
 *   When a user is signed in, AuthModule maintains an internal
 *   onSnapshot listener on `users/{currentUid}` and watches the
 *   `roleChangedAt` field. When the server bumps it (because
 *   setUserRole or set-role.js ran), AuthModule calls refreshRole
 *   to force a token refresh; the new claim then propagates to all
 *   subscribers of `onIdTokenChanged` (including modules/role.ts'
 *   onRoleChange).
 *
 *   The snapshot listener is owned by AuthModule and lives only while
 *   a user is signed in — it tears down on sign-out so we don't leak
 *   listeners (per constitution §IV.2).
 */

import { auth, db } from '@/firebase-config';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { type Result, success, failure } from '@/types/result';
import { createRepositoryFactory } from '@/repositories/repository-factory';
import type { UserRepository } from '@/repositories/user-repository';
import { getRole, refreshRole } from '@/modules/role';
import type { Role } from '@/types/user';

export class AuthModule {
  private readonly _provider = new GoogleAuthProvider();
  private readonly _userRepo: UserRepository;
  private _snapshotUnsub: Unsubscribe | null = null;
  private _lastRoleChangedAtMs: number | null = null;
  private _internalAuthUnsub: () => void;

  constructor() {
    this._userRepo = createRepositoryFactory({ db }).getUserRepository();

    // Internal: keep the role-change snapshot listener in sync with
    // sign-in/sign-out lifecycle, and refresh lastSignInAt on every
    // authenticated session start. Exposed onAuthStateChanged is for
    // consumers; this internal subscription is independent of it.
    this._internalAuthUnsub = firebaseOnAuthStateChanged(auth, (user) => {
      this._teardownSnapshot();
      if (user) {
        this._setupSnapshot(user.uid);
        void this._userRepo.touchLastSignIn(user.uid);
      }
    });
  }

  get currentUser(): User | null {
    return auth.currentUser;
  }

  async signIn(): Promise<Result<UserCredential>> {
    try {
      const credential = await signInWithPopup(auth, this._provider);
      return success(credential);
    } catch (error) {
      console.error('[AuthModule] signIn error:', error);
      return failure(String(error), 'AUTH_ERROR');
    }
  }

  async signOut(): Promise<Result<void>> {
    try {
      await firebaseSignOut(auth);
      return success(undefined);
    } catch (error) {
      console.error('[AuthModule] signOut error:', error);
      return failure(String(error), 'AUTH_ERROR');
    }
  }

  /**
   * Read the current user's role from the ID token claim. Returns
   * null if signed out or if the claim is missing/invalid.
   *
   * @param force pass true to force a token refresh before reading
   */
  async getRole(force = false): Promise<Role | null> {
    return getRole(force);
  }

  /**
   * Force a token refresh and return the freshly-read role. Used
   * imperatively (e.g. after a known role change) when waiting for
   * the snapshot-driven refresh isn't acceptable.
   */
  async refreshTokenAndRole(): Promise<Role | null> {
    return refreshRole();
  }

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return firebaseOnAuthStateChanged(auth, callback);
  }

  /**
   * Tear down the AuthModule. Currently only useful in tests; the
   * production app keeps a single AuthModule for the page lifetime.
   */
  destroy(): void {
    this._teardownSnapshot();
    this._internalAuthUnsub();
  }

  // ─── Internal: roleChangedAt snapshot listener ──────────────────────────

  private _setupSnapshot(uid: string): void {
    this._snapshotUnsub = onSnapshot(doc(db, 'users', uid), async (snap) => {
      if (!snap.exists()) return;
      const ts = snap.data()?.['roleChangedAt'];
      const tsMs = (ts && typeof ts.toMillis === 'function') ? (ts.toMillis() as number) : null;

      if (this._lastRoleChangedAtMs === null) {
        // First snapshot after sign-in — establish baseline. Don't
        // force-refresh; the token's claim is already up to date.
        this._lastRoleChangedAtMs = tsMs ?? 0;
        return;
      }

      if (tsMs !== null && tsMs !== this._lastRoleChangedAtMs) {
        // Server bumped the role mid-session. Force token refresh so
        // the rules engine sees the new claim immediately — for
        // cooperative clients running this code. A hostile client can
        // skip this refresh and retain the old claim until its ID token
        // expires (≤1h; setUserRole does not revoke refresh tokens —
        // see 002-multi-user-rbac spec §VI.1). onIdTokenChanged
        // subscribers (modules/role.ts) propagate the change to UI
        // consumers.
        await refreshRole();
        this._lastRoleChangedAtMs = tsMs;
      }
    });
  }

  private _teardownSnapshot(): void {
    if (this._snapshotUnsub) {
      this._snapshotUnsub();
      this._snapshotUnsub = null;
    }
    this._lastRoleChangedAtMs = null;
  }
}
