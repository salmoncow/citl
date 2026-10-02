/**
 * Member account types (spec 008): profile document, provider ids, and
 * the request/response shapes of the account callables.
 */

import type { Timestamp } from 'firebase/firestore';
import type { AccountStatus } from '@/types/user';

/**
 * Firebase Auth provider ids the site supports. Email link signs in
 * under the 'password' provider (sign-in method 'emailLink').
 */
export type AuthProviderId = 'google.com' | 'password';

/**
 * Shape of a `profiles/{uid}` document: the member-supplied profile,
 * separate from the server-owned `users/{uid}` RBAC mirror. Private
 * (self + owner/admin). Field limits are enforced in firestore.rules and
 * mirrored in services/profile-validation.ts.
 */
export interface ProfileDoc {
  /** Present on profiles saved after the name split (2026-10-02). */
  firstName?: string;
  lastName?: string;
  /** Always `${firstName} ${lastName}` when both are present (rules check this). */
  displayName: string;
  phone?: string;
  acceptedTermsAt: Timestamp;
  termsVersion: string;
  adultAttested: true;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Member-editable profile fields. */
export interface ProfileInput {
  firstName: string;
  lastName: string;
  /** Omitted or empty means no phone. */
  phone?: string;
}

export interface SetAccountStatusRequest {
  status: AccountStatus;
}

export interface SetAccountStatusResponse {
  ok: true;
  status: AccountStatus;
  changed: boolean;
}

export interface DeleteAccountRequest {
  confirm: 'DELETE';
}

export interface DeleteAccountResponse {
  ok: true;
}
