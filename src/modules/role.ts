/**
 * RoleModule — single source of role state on the client.
 *
 * Reads the `role` claim from the current ID token; subscribes to
 * onIdTokenChanged so consumers learn about role changes immediately
 * after a forced token refresh (Group 6 wires the refresh trigger via
 * a snapshot listener on users/{uid}.roleChangedAt).
 *
 * The token claim is the rules-engine source of truth. The Firestore
 * mirror is the admin-UI source of truth and may briefly lag the
 * claim if a setUserRole TX commit failed post-claim — see spec §VI.
 */

import { auth } from '@/firebase-config';
import { isRole, type Role } from '@/types/user';

export type RoleChangeCallback = (role: Role | null) => void;

export async function getRole(force = false): Promise<Role | null> {
  if (!auth.currentUser) return null;
  const token = await auth.currentUser.getIdTokenResult(force);
  return isRole(token.claims['role']) ? (token.claims['role'] as Role) : null;
}

/**
 * Subscribe to role changes. Fires:
 *   - on sign-in (with current role)
 *   - on sign-out (with null)
 *   - whenever the ID token refreshes with a different `role` claim
 *
 * Returns an unsubscribe function.
 */
export function onRoleChange(cb: RoleChangeCallback): () => void {
  return auth.onIdTokenChanged(async (user) => {
    if (!user) {
      cb(null);
      return;
    }
    const token = await user.getIdTokenResult();
    cb(isRole(token.claims['role']) ? (token.claims['role'] as Role) : null);
  });
}

/**
 * Force a token refresh and return the freshly-read role. Used after a
 * roleChangedAt snapshot bump indicates the server has updated the
 * caller's role and we need the new value to propagate to UI guards
 * before the natural ~1-hour token lifetime expires.
 */
export async function refreshRole(): Promise<Role | null> {
  return getRole(true);
}
