/**
 * User + role types shared across the RBAC client surfaces.
 */

import type { Timestamp } from 'firebase/firestore';

export type Role = 'owner' | 'admin' | 'user';

export const ROLES: readonly Role[] = ['owner', 'admin', 'user'] as const;

export function isRole(value: unknown): value is Role {
  return value === 'owner' || value === 'admin' || value === 'user';
}

/**
 * Shape of a `users/{uid}` document. The `role` field is server-managed
 * (written by onUserCreate or setUserRole — never by the client SDK).
 */
export interface UserDoc {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: Role;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastSignInAt?: Timestamp | null;
  roleChangedAt?: Timestamp;
}
