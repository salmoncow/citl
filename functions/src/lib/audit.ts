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

/** Spec 009: a captain submitted or withdrew a team proposal. */
export interface ProposalEntry {
  kind: 'proposal';
  actorUid: string;
  subjectId: string;
  action: 'submitted' | 'withdrawn' | 'deleted';
}

export type AuditEntry = RoleChangeEntry | AccountStatusEntry | ProposalEntry;

/** Queue an audit entry (with server `at`) on a transaction or batch. */
export function queueAuditEntry(
  writer: Transaction | WriteBatch,
  db: Firestore,
  entry: AuditEntry,
): void {
  const ref = db.collection('audit').doc();
  writer.create(ref, { ...entry, at: FieldValue.serverTimestamp() });
}
