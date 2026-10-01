/**
 * Zod schemas for callable function inputs.
 *
 * Validation runs before any privileged operation; any failure is
 * surfaced as `invalid-argument` to the caller.
 */

import { z } from 'zod';

export const ROLES = ['owner', 'admin', 'user'] as const;
export type Role = (typeof ROLES)[number];

export const setUserRoleInput = z.object({
  targetUid: z.string().min(1).max(128),
  role: z.enum(ROLES),
});

export type SetUserRoleInput = z.infer<typeof setUserRoleInput>;

export const ACCOUNT_STATUSES = ['active', 'deactivated'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const setAccountStatusInput = z.object({
  status: z.enum(ACCOUNT_STATUSES),
});

export type SetAccountStatusInput = z.infer<typeof setAccountStatusInput>;

export const deleteAccountInput = z.object({
  confirm: z.literal('DELETE'),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountInput>;

/** HttpsError details reason when an owner/admin calls a self-service account callable (DD-7). */
export const PRIVILEGED_ROLE_REASON = 'privileged-role';

export function isPrivileged(role: unknown): boolean {
  return role === 'owner' || role === 'admin';
}
