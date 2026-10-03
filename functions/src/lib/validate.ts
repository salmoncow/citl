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

// ── teamProposal (spec 009) ─────────────────────────────────────────────────
// Limits mirror functions/src/lib/roster.ts and src/services/league-validation.ts.

const namePart = z.string().trim().min(1).max(30).regex(/^\p{L}[\p{L}\p{M} .'-]*$/u);
const teamName = z.string().trim().min(2).max(40).regex(/^[\p{L}\p{N}][\p{L}\p{N}\p{M} &'.-]*$/u);
const docId = z.string().min(1).max(100).regex(/^[^/]+$/);
const year = z.number().int().min(2000).max(3000);

const rosterEntryInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('self'), rookie: z.boolean() }),
  z.object({ kind: z.literal('dependent'), dependentId: docId, rookie: z.boolean() }),
  z.object({
    kind: z.literal('named'),
    firstName: namePart,
    lastName: namePart,
    rookie: z.boolean(),
    minor: z.boolean(),
    guardianName: z.string().trim().min(1).max(61).nullish(),
  }),
]);

export const TEAM_SOURCES = ['new', 'returning'] as const;
export type TeamSource = (typeof TEAM_SOURCES)[number];

export const teamProposalInput = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('save'),
    year,
    teamSource: z.enum(TEAM_SOURCES),
    leagueTeamId: docId.nullable(),
    teamName,
    // Over-long rosters get a specific message from resolveRoster; 50 only
    // bounds the payload.
    shooters: z.array(rosterEntryInput).max(50),
  }),
  z.object({ action: z.literal('submit'), year }),
  z.object({ action: z.literal('withdraw'), year }),
  z.object({ action: z.literal('delete'), year }),
]);

export type TeamProposalInput = z.infer<typeof teamProposalInput>;
