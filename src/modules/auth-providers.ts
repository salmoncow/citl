/**
 * Auth providers — sign-in, linking and re-authentication for every
 * enabled provider (spec 008 F2).
 *
 * Providers: Google (popup, DD-3) and passwordless email link (DD-4).
 * Microsoft was dropped 2026-10-02 (owner decision). The enabled set comes from VITE_AUTH_PROVIDERS.
 *
 * Account linking (AC-6): when a popup sign-in fails with
 * `auth/account-exists-with-different-credential`, the pending credential
 * is held in memory and the user is asked to sign in with a method they
 * used before. The next successful sign-in links the pending credential.
 * fetchSignInMethodsForEmail is never used (email enumeration protection
 * stays on).
 *
 * Email link: the address and intent are kept in localStorage under one
 * namespaced key so the link can be completed after the page reloads.
 * A link opened on another device has no stored address, so the caller
 * asks for it.
 *
 * Loaded lazily (dynamic import from the sign-in dialog, account page
 * and boot email-link check) to keep it out of the main bundle (AC-9).
 */

import { auth } from '@/firebase-config';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  unlink,
  type AuthCredential,
  type AuthProvider,
  type User,
} from 'firebase/auth';
import type { AuthProviderId } from '@/types/account';
import { showToast } from '@/modules/ui';

export { looksLikeEmailLink } from '@/utils/email-link';

// ─── Provider configuration ─────────────────────────────────────────────────

export type ProviderKey = 'google' | 'email';
export type PopupProviderKey = Exclude<ProviderKey, 'email'>;

export const ALL_PROVIDERS: readonly ProviderKey[] = ['google', 'email'];

export const PROVIDER_IDS: Record<ProviderKey, AuthProviderId> = {
  google: 'google.com',
  email: 'password',
};

export const PROVIDER_LABELS: Record<ProviderKey, string> = {
  google: 'Google',
  email: 'Email link',
};

export function providerKeyOf(providerId: string): ProviderKey | null {
  const entry = (Object.entries(PROVIDER_IDS) as [ProviderKey, AuthProviderId][])
    .find(([, id]) => id === providerId);
  return entry ? entry[0] : null;
}

/**
 * Parse VITE_AUTH_PROVIDERS ("google,email"). Unknown names are
 * ignored, duplicates dropped, order kept. Empty or unset → all providers.
 */
export function parseEnabledProviders(raw: string | undefined): ProviderKey[] {
  const keys = (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ProviderKey => (ALL_PROVIDERS as readonly string[]).includes(s));
  const unique = [...new Set(keys)];
  return unique.length > 0 ? unique : [...ALL_PROVIDERS];
}

export function enabledProviders(): ProviderKey[] {
  return parseEnabledProviders(import.meta.env.VITE_AUTH_PROVIDERS);
}

function popupProvider(_key: PopupProviderKey): AuthProvider {
  return new GoogleAuthProvider();
}

/** Unlinking the last provider would lock the user out (DD-6, UX only). */
export function canUnlink(providerData: readonly { providerId: string }[]): boolean {
  return providerData.length > 1;
}

// ─── Outcomes and error messages ────────────────────────────────────────────

export type AuthOutcome =
  | { status: 'signed-in'; linked?: AuthProviderId }
  | { status: 'linked'; providerId: AuthProviderId }
  | { status: 'reauthenticated' }
  | { status: 'account-exists'; email: string | null }
  | { status: 'email-sent'; email: string }
  | { status: 'needs-email' }
  | { status: 'cancelled' }
  | { status: 'error'; code: string; message: string };

const SILENT_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']);

export function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
    case 'auth/network-request-failed':
      return 'Can’t reach the sign-in service. Check your connection and try again.';
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return 'Enter a valid email address.';
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'This sign-in link has expired or was already used. Request a new one.';
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/credential-already-in-use':
    case 'auth/email-already-in-use':
      return 'That sign-in method already belongs to a different account.';
    case 'auth/provider-already-linked':
      return 'That sign-in method is already connected.';
    case 'auth/requires-recent-login':
      return 'For your security, please sign in again and retry.';
    case 'auth/operation-not-allowed':
      return 'That sign-in method isn’t available right now.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-mismatch':
      return 'Sign in with the account you’re already using.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}

function errorOutcome(e: unknown): AuthOutcome {
  const code = (e as { code?: string } | null)?.code ?? 'unknown';
  if (SILENT_CODES.has(code)) return { status: 'cancelled' };
  console.error('[auth-providers]', e);
  return { status: 'error', code, message: authErrorMessage(code) };
}

// ─── Pending credential (account-exists linking, AC-6) ──────────────────────

let pending: { email: string | null; credential: AuthCredential } | null = null;
let pendingWatchUnsub: (() => void) | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * How long a held credential waits for the matching sign-in. Bounded so
 * that on a shared computer it can't attach to someone else's later
 * sign-in in the same tab.
 */
export const PENDING_LINK_TTL_MS = 10 * 60 * 1000;

/**
 * Hold the credential and watch for the next sign-in. The watcher covers
 * the email-link case: the link is usually opened in another tab, and
 * Firebase syncs that sign-in back to this tab, which still holds the
 * credential in memory.
 */
function setPending(value: { email: string | null; credential: AuthCredential }): void {
  clearPendingLink();
  pending = value;
  pendingTimer = setTimeout(clearPendingLink, PENDING_LINK_TTL_MS);
  let first = true;
  pendingWatchUnsub = onAuthStateChanged(auth, (user) => {
    // The first callback reports the current (signed-out) state.
    if (first) { first = false; if (!user) return; }
    if (user && pending) void applyPendingLink(user);
  });
}

/**
 * Pull the email and pending OAuth credential out of an
 * account-exists-with-different-credential error. Returns null for any
 * other error or when no credential can be recovered.
 */
export function extractAccountExists(
  error: unknown,
): { email: string | null; credential: AuthCredential } | null {
  const err = error as { code?: string; customData?: { email?: string } } | null;
  if (err?.code !== 'auth/account-exists-with-different-credential') return null;
  const credential = GoogleAuthProvider.credentialFromError(error as never);
  if (!credential) return null;
  return { email: err.customData?.email ?? null, credential };
}

export function pendingLinkEmail(): string | null {
  return pending?.email ?? null;
}

export function hasPendingLink(): boolean {
  return pending !== null;
}

export function clearPendingLink(): void {
  pending = null;
  pendingWatchUnsub?.();
  pendingWatchUnsub = null;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
}

/** After any successful sign-in, attach the held credential (if any). */
async function applyPendingLink(user: User): Promise<AuthProviderId | undefined> {
  if (!pending) return undefined;
  const { credential } = pending;
  clearPendingLink();
  const providerId = credential.providerId as AuthProviderId;
  const label = PROVIDER_LABELS[providerKeyOf(providerId) ?? 'email'];
  try {
    await linkWithCredential(user, credential);
    showToast('success', `${label} is now connected to your account.`);
    return providerId;
  } catch (e) {
    console.warn('[auth-providers] pending link failed:', e);
    showToast('error', `Signed in, but ${label} couldn’t be connected. You can connect it from your account page.`);
    return undefined;
  }
}

// ─── Current user (components never import firebase/auth) ───────────────────

export interface CurrentUserInfo {
  uid: string;
  email: string | null;
  providerIds: AuthProviderId[];
}

export function currentUserInfo(): CurrentUserInfo | null {
  const user = auth.currentUser;
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    providerIds: user.providerData
      .map((p) => p.providerId)
      .filter((id): id is AuthProviderId => providerKeyOf(id) !== null),
  };
}

/** Re-read provider data after link/unlink (the User object mutates in place). */
export async function reloadCurrentUser(): Promise<CurrentUserInfo | null> {
  await auth.currentUser?.reload();
  return currentUserInfo();
}

// ─── Popup sign-in, link, unlink, reauthenticate ────────────────────────────

export async function signInWith(key: PopupProviderKey): Promise<AuthOutcome> {
  try {
    const cred = await signInWithPopup(auth, popupProvider(key));
    const linked = await applyPendingLink(cred.user);
    return linked ? { status: 'signed-in', linked } : { status: 'signed-in' };
  } catch (e) {
    const exists = extractAccountExists(e);
    if (exists) {
      setPending(exists);
      return { status: 'account-exists', email: exists.email };
    }
    return errorOutcome(e);
  }
}

export async function linkProvider(key: PopupProviderKey): Promise<AuthOutcome> {
  const user = auth.currentUser;
  if (!user) return { status: 'error', code: 'auth/no-current-user', message: 'Sign in first.' };
  try {
    await linkWithPopup(user, popupProvider(key));
    return { status: 'linked', providerId: PROVIDER_IDS[key] };
  } catch (e) {
    return errorOutcome(e);
  }
}

export async function unlinkProvider(providerId: AuthProviderId): Promise<AuthOutcome> {
  const user = auth.currentUser;
  if (!user) return { status: 'error', code: 'auth/no-current-user', message: 'Sign in first.' };
  if (!canUnlink(user.providerData)) {
    return { status: 'error', code: 'last-provider', message: 'You can’t remove your only sign-in method.' };
  }
  try {
    await unlink(user, providerId);
    return { status: 'linked', providerId };
  } catch (e) {
    return errorOutcome(e);
  }
}

/**
 * Prove a recent sign-in (deleteAccount requires auth_time ≤ 5 min).
 * Uses a linked popup provider when there is one; otherwise sends a
 * fresh email link with the `reauth` intent.
 */
export async function reauthenticate(): Promise<AuthOutcome> {
  const user = auth.currentUser;
  if (!user) return { status: 'error', code: 'auth/no-current-user', message: 'Sign in first.' };
  const popupKey = user.providerData
    .map((p) => providerKeyOf(p.providerId))
    .find((k): k is PopupProviderKey => k === 'google');
  if (popupKey) {
    try {
      await reauthenticateWithPopup(user, popupProvider(popupKey));
      return { status: 'reauthenticated' };
    } catch (e) {
      return errorOutcome(e);
    }
  }
  if (!user.email) return { status: 'error', code: 'auth/missing-email', message: authErrorMessage('auth/missing-email') };
  return sendEmailLink(user.email, 'reauth');
}

// ─── Email link ─────────────────────────────────────────────────────────────

export type EmailLinkIntent = 'sign-in' | 'link' | 'reauth';

export const EMAIL_LINK_STORAGE_KEY = 'citl.auth.emailLink';

interface StoredEmailLink {
  email: string;
  intent: EmailLinkIntent;
}

export function readStoredEmailLink(): StoredEmailLink | null {
  try {
    const raw = localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredEmailLink>;
    if (typeof parsed.email !== 'string') return null;
    const intent: EmailLinkIntent =
      parsed.intent === 'link' || parsed.intent === 'reauth' ? parsed.intent : 'sign-in';
    return { email: parsed.email, intent };
  } catch {
    return null;
  }
}

function storeEmailLink(value: StoredEmailLink): void {
  try {
    localStorage.setItem(EMAIL_LINK_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable: completion will ask for the email instead.
  }
}

function clearStoredEmailLink(): void {
  try {
    localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Continue URL is the origin root, not a hash route (DD-4). */
export function emailLinkContinueUrl(origin: string = window.location.origin): string {
  return `${origin}/`;
}

export async function sendEmailLink(email: string, intent: EmailLinkIntent = 'sign-in'): Promise<AuthOutcome> {
  const address = email.trim();
  try {
    await sendSignInLinkToEmail(auth, address, {
      url: emailLinkContinueUrl(),
      handleCodeInApp: true,
    });
    storeEmailLink({ email: address, intent });
    return { status: 'email-sent', email: address };
  } catch (e) {
    return errorOutcome(e);
  }
}

/**
 * Complete an email link. `email` overrides the stored address (used
 * when the link was opened on another device). Returns `needs-email`
 * when neither is available.
 */
export async function completeEmailLink(url: string, email?: string): Promise<AuthOutcome> {
  if (!isSignInWithEmailLink(auth, url)) {
    return { status: 'error', code: 'auth/invalid-action-code', message: authErrorMessage('auth/invalid-action-code') };
  }
  const stored = readStoredEmailLink();
  const address = email?.trim() || stored?.email;
  if (!address) return { status: 'needs-email' };
  // A typed address on a new device carries no intent: treat as sign-in.
  const intent: EmailLinkIntent = email ? 'sign-in' : (stored?.intent ?? 'sign-in');
  const user = auth.currentUser;

  try {
    if (intent === 'link' && user) {
      await linkWithCredential(user, EmailAuthProvider.credentialWithLink(address, url));
      clearStoredEmailLink();
      return { status: 'linked', providerId: 'password' };
    }
    if (intent === 'reauth' && user) {
      await reauthenticateWithCredential(user, EmailAuthProvider.credentialWithLink(address, url));
      clearStoredEmailLink();
      return { status: 'reauthenticated' };
    }
    const cred = await signInWithEmailLink(auth, address, url);
    clearStoredEmailLink();
    const linked = await applyPendingLink(cred.user);
    return linked ? { status: 'signed-in', linked } : { status: 'signed-in' };
  } catch (e) {
    return errorOutcome(e);
  }
}
