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
