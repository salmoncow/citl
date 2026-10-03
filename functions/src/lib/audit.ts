/**
 * Audit log writer. Every entry goes to audit/{auto} and is readable by
 * the owner only (firestore.rules). Entries carry uids, never email or
 * name, so an entry can outlive a deleted account without holding PII.
 *
 * `kind` discriminates the entry type. Legacy role-change entries written
 * before spec 008 have no `kind`; readers treat a missing kind as
 * 'role-change'.
 */

import { FieldValue, type Firestore, type Transaction, type WriteBatch } from 'firebase-admin/firestore';
import type { AccountStatus, Role } from './validate.js';

export interface RoleChangeEntry {
  kind: 'role-change';
  actorUid: string;
  targetUid: string;
  fromRole: Role;
  toRole: Role;
}

export interface AccountStatusEntry {
  kind: 'account-status';
  actorUid: string;
  targetUid: string;
  fromStatus: AccountStatus;
  toStatus: AccountStatus | 'deleted';
}

/** Spec 009/010: a captain or the coordinator acted on a team proposal. */
export interface ProposalEntry {
  kind: 'proposal';
  actorUid: string;
  subjectId: string;
  action:
    | 'submitted' | 'withdrawn' | 'deleted' | 'reopened' | 'discarded'
    | 'approved' | 'rejected' | 'changes-requested';
}

/** Spec 010: the coordinator placed or declined a registration. */
export interface RegistrationEntry {
  kind: 'registration';
  actorUid: string;
  subjectId: string;
  action: 'placed' | 'declined';
}

/** Spec 010: the coordinator decided a shooter link request (subjectId = member uid). */
export interface ShooterLinkEntry {
  kind: 'shooter-link';
  actorUid: string;
  subjectId: string;
  action: 'approved' | 'declined';
}

/** Spec 010: a captain handoff step (subjectId = league team id). */
export interface CaptainEntry {
  kind: 'captain';
  actorUid: string;
  subjectId: string;
  action: 'nominated' | 'cancelled' | 'accepted' | 'declined' | 'approved' | 'rejected' | 'cleared';
  targetUid?: string;
}

export type AuditEntry =
  | RoleChangeEntry
  | AccountStatusEntry
  | ProposalEntry
  | RegistrationEntry
  | ShooterLinkEntry
  | CaptainEntry;

/** Queue an audit entry (with server `at`) on a transaction or batch. */
export function queueAuditEntry(
  writer: Transaction | WriteBatch,
  db: Firestore,
  entry: AuditEntry,
): void {
  const ref = db.collection('audit').doc();
  writer.create(ref, { ...entry, at: FieldValue.serverTimestamp() });
}
