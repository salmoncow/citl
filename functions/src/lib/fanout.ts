/**
 * Topic fan-out (spec 011 AC-11, DD-4). Claims notifications/{key} with
 * create() so a repeated or retried event sends once, then writes one
 * mail doc per subscribed, active member with an email.
 */

import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { MAIL_TTL_MS } from '../mail/config.js';
import type { MailContent, MailKind, Topic } from '../mail/types.js';

const GET_ALL_CHUNK = 100;
const BATCH_SIZE = 400;
/** Far above league size; keeps the query bounded (constitution §IV.2). */
const MAX_RECIPIENTS = 2000;

const ALREADY_EXISTS = 6;

/** Returns the recipient count, or null when the key was already claimed. */
export async function fanOut(
  db: Firestore,
  key: string,
  topic: Topic,
  kind: MailKind,
  content: MailContent,
  now: number = Date.now(),
): Promise<number | null> {
  const claim = db.doc(`notifications/${key}`);
  try {
    await claim.create({ topic, recipients: 0, createdAt: FieldValue.serverTimestamp() });
  } catch (err) {
    if ((err as { code?: number }).code === ALREADY_EXISTS) return null;
    throw err;
  }

  const subscribed = await db.collection('notificationSettings')
    .where(`topics.${topic}`, '==', true)
    .limit(MAX_RECIPIENTS)
    .get();
  const uids = subscribed.docs.map((d) => d.id);

  const recipients: string[] = [];
  for (let i = 0; i < uids.length; i += GET_ALL_CHUNK) {
    const refs = uids.slice(i, i + GET_ALL_CHUNK).map((uid) => db.doc(`users/${uid}`));
    if (refs.length === 0) continue;
    const users = await db.getAll(...refs);
    for (const u of users) {
      const d = u.data();
      if (u.exists && (d?.['status'] ?? 'active') === 'active' && typeof d?.['email'] === 'string' && d['email']) {
        recipients.push(u.id);
      }
    }
  }

  const expireAt = Timestamp.fromMillis(now + MAIL_TTL_MS);
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const uid of recipients.slice(i, i + BATCH_SIZE)) {
      batch.set(db.collection('mail').doc(), {
        uid, kind, topic, ...content,
        status: 'pending', attempts: 0, createdAt: FieldValue.serverTimestamp(), expireAt,
      });
    }
    await batch.commit();
  }
  await claim.update({ recipients: recipients.length });
  return recipients.length;
}
