/**
 * Outbox write for status emails (spec 011 AC-15, DD-3). The mail doc is
 * written in the caller's transaction, so a decision and its email commit
 * together. It reads nothing: sendMail checks the recipient at send time.
 */

import { FieldValue, Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { MAIL_TTL_MS } from '../mail/config.js';
import type { MailContent } from '../mail/types.js';

export function queueMail(
  tx: Transaction,
  db: Firestore,
  uid: string,
  content: MailContent,
  kind: 'status' | 'digest' = 'status',
): void {
  tx.set(db.collection('mail').doc(), {
    uid,
    kind,
    ...content,
    status: 'pending',
    attempts: 0,
    createdAt: FieldValue.serverTimestamp(),
    expireAt: Timestamp.fromMillis(Date.now() + MAIL_TTL_MS),
  });
}
