/**
 * Account gate (spec 008 AC-10, AC-12, AC-15).
 *
 * Decides whether a signed-in user must finish something on /account
 * before using the rest of the site:
 *   - reactivate:       users/{uid}.status is 'deactivated'
 *   - complete-profile: no profiles/{uid} doc yet (first sign-in)
 *   - accept-terms:     profile termsVersion differs from TERMS_VERSION
 *   - none:             nothing to do, or still loading
 *
 * decideAccountGate is pure (unit-tested). AccountGate is a small
 * stateful wrapper: it follows AuthModule's users/{uid} snapshot (no new
 * listener) and reads profiles/{uid} once per signed-in uid (AC-23).
 * main.ts applies the decision in onBeforeNavigate; this is UX only —
 * rules and callables enforce.
 */

import type { AccountStatus, UserDoc } from '@/types/user';
import type { ProfileDoc } from '@/types/account';
import { accountStatusOf } from '@/types/user';

export type GateDecision = 'none' | 'complete-profile' | 'accept-terms' | 'reactivate';

export interface GateInput {
  signedIn: boolean;
  /** users/{uid} snapshot has arrived (doc may still be null). */
  userDocLoaded: boolean;
  userStatus: AccountStatus;
  /** profiles/{uid} read has finished. */
  profileLoaded: boolean;
  profileTermsVersion: string | null;
  hasProfile: boolean;
  currentTermsVersion: string;
}

export function decideAccountGate(i: GateInput): GateDecision {
  if (!i.signedIn) return 'none';
  if (i.userDocLoaded && i.userStatus === 'deactivated') return 'reactivate';
  if (!i.profileLoaded) return 'none';
  if (!i.hasProfile) return 'complete-profile';
  if (i.profileTermsVersion !== i.currentTermsVersion) return 'accept-terms';
  return 'none';
}

/** Paths a gated user may still visit. */
export const GATE_ALLOWED_PATHS: readonly string[] = ['/account', '/privacy'];

export function isGatedPath(decision: GateDecision, path: string): boolean {
  return decision !== 'none' && !GATE_ALLOWED_PATHS.includes(path);
}

// ─── Stateful wrapper ───────────────────────────────────────────────────────

export interface UserDocState {
  uid: string | null;
  loaded: boolean;
  doc: UserDoc | null;
}

export interface AccountGateDeps {
  onUserDoc: (cb: (state: UserDocState) => void) => () => void;
  loadProfile: (uid: string) => Promise<ProfileDoc | null>;
  termsVersion: string;
}

export type ProfileLoadState = 'idle' | 'loading' | 'ready' | 'error';

export class AccountGate {
  private _uid: string | null = null;
  private _userDoc: UserDocState = { uid: null, loaded: false, doc: null };
  private _profileState: ProfileLoadState = 'idle';
  private _profile: ProfileDoc | null = null;
  private _decision: GateDecision = 'none';
  private readonly _listeners = new Set<(d: GateDecision) => void>();
  private readonly _updateListeners = new Set<() => void>();
  private readonly _unsub: () => void;

  constructor(private readonly deps: AccountGateDeps) {
    this._unsub = deps.onUserDoc((state) => this._onUserDoc(state));
  }

  get decision(): GateDecision {
    return this._decision;
  }

  get profile(): ProfileDoc | null {
    return this._profile;
  }

  get profileState(): ProfileLoadState {
    return this._profileState;
  }

  get userDoc(): UserDocState {
    return this._userDoc;
  }

  /** Subscribe to decision changes; returns an unsubscribe. */
  onChange(cb: (d: GateDecision) => void): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  /**
   * Subscribe to any state change (user doc, profile, decision). Used by
   * the account page so it shares the gate's single profile read.
   */
  onUpdate(cb: () => void): () => void {
    this._updateListeners.add(cb);
    return () => this._updateListeners.delete(cb);
  }

  /** Re-read the profile (after completion, edit, or terms acceptance). */
  async refresh(): Promise<void> {
    if (this._uid) await this._loadProfile(this._uid);
  }

  destroy(): void {
    this._unsub();
    this._listeners.clear();
    this._updateListeners.clear();
  }

  private _onUserDoc(state: UserDocState): void {
    this._userDoc = state;
    if (state.uid !== this._uid) {
      this._uid = state.uid;
      this._profileState = 'idle';
      this._profile = null;
      if (state.uid) void this._loadProfile(state.uid);
    }
    this._recompute();
  }

  private async _loadProfile(uid: string): Promise<void> {
    this._profileState = 'loading';
    this._notifyUpdate();
    try {
      const profile = await this.deps.loadProfile(uid);
      if (this._uid !== uid) return;
      this._profile = profile;
      this._profileState = 'ready';
    } catch (e) {
      // A failed read must not lock the user out of the site; the
      // account page shows its own error state.
      console.warn('[account-gate] profile load failed:', e);
      if (this._uid !== uid) return;
      this._profileState = 'error';
    }
    this._recompute();
  }

  private _notifyUpdate(): void {
    for (const cb of this._updateListeners) cb();
  }

  private _recompute(): void {
    const next = decideAccountGate({
      signedIn: this._uid !== null,
      userDocLoaded: this._userDoc.loaded,
      userStatus: accountStatusOf(this._userDoc.doc),
      profileLoaded: this._profileState === 'ready',
      hasProfile: this._profile !== null,
      profileTermsVersion: this._profile?.termsVersion ?? null,
      currentTermsVersion: this.deps.termsVersion,
    });
    const changed = next !== this._decision;
    this._decision = next;
    if (changed) for (const cb of this._listeners) cb(next);
    this._notifyUpdate();
  }
}
