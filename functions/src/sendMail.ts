/**
 * sendMail — sends each mail/{id} doc once (spec 011 AC-8, DD-3).
 *
 * Sequence: claim the doc in a transaction (pending → sending, or a stale
 * sending claim); re-read the recipient and, for topic mail, their topic;
 * render with the recipient's footer; send through SES; record the result.
 * A retryable SES error returns the doc to pending and rethrows so the
 * event retries, up to MAX_ATTEMPTS; any other error marks it failed.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { CLAIM_STALE_MS, MAX_ATTEMPTS, SITE_URL, UNSUBSCRIBE_SECRET } from './mail/config.js';
import { renderMail, type Footer } from './mail/templates.js';
import { RetryableMailError, transport } from './mail/ses.js';
import type { MailContent, MailStatus, Topic } from './mail/types.js';
import { isTopic, unsubscribeUrl } from './lib/unsubscribeToken.js';

if (getApps().length === 0) {
  initializeApp();
}

export type SendOutcome = 'sent' | 'skipped' | 'failed' | 'ignored';

function asContent(d: FirebaseFirestore.DocumentData): MailContent {
  const link = d['link'] as { label?: unknown; path?: unknown } | undefined;
  return {
    subject: String(d['subject'] ?? ''),
    paragraphs: Array.isArray(d['paragraphs']) ? d['paragraphs'].map(String) : [],
    ...(link && typeof link.label === 'string' && typeof link.path === 'string'
      ? { link: { label: link.label, path: link.path } }
      : {}),
  };
}

export async function handleMailCreated(id: string, now: number = Date.now()): Promise<SendOutcome> {
  const db = getFirestore();
  const ref = db.doc(`mail/${id}`);

  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.data();
    if (!d) return null;
    const status = d['status'] as MailStatus;
    const claimedAt = (d['claimedAt'] as Timestamp | undefined)?.toMillis() ?? 0;
    if (status !== 'pending' && !(status === 'sending' && now - claimedAt > CLAIM_STALE_MS)) return null;
    const attempts = Number(d['attempts'] ?? 0) + 1;
    tx.update(ref, { status: 'sending', attempts, claimedAt: Timestamp.fromMillis(now) });
    return { d, attempts };
  });
  if (!claimed) return 'ignored';
  const { d, attempts } = claimed;

  const uid = String(d['uid'] ?? '');
  const topic: Topic | null = isTopic(d['topic']) ? d['topic'] : null;
  const [user, settings] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    topic ? db.doc(`notificationSettings/${uid}`).get() : Promise.resolve(null),
  ]);
  const email = user.data()?.['email'];
  const skipReason = !user.exists ? 'no-account'
    : (user.data()?.['status'] ?? 'active') !== 'active' ? 'deactivated'
    : typeof email !== 'string' || email.length === 0 ? 'no-email'
    : topic && settings?.data()?.['topics']?.[topic] !== true ? 'topic-off'
    : null;
  if (skipReason) {
    await ref.update({ status: 'skipped', error: skipReason });
    return 'skipped';
  }

  let footer: Footer = { kind: 'account' };
  let headers: Record<string, string> | undefined;
  if (topic) {
    const url = unsubscribeUrl(SITE_URL, UNSUBSCRIBE_SECRET.value(), uid, topic);
    footer = { kind: 'topic', topic, unsubscribeUrl: url };
    headers = { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
  }
  const rendered = renderMail(asContent(d), footer);

  try {
    await transport().send({ to: email as string, ...rendered, ...(headers ? { headers } : {}) });
  } catch (err) {
    const message = String((err as Error)?.message ?? err).slice(0, 500);
    if (err instanceof RetryableMailError && attempts < MAX_ATTEMPTS) {
      await ref.update({ status: 'pending', error: message });
      throw err;
    }
    logger.error('sendMail failed', { id, attempts, message });
    await ref.update({ status: 'failed', error: message });
    return 'failed';
  }
  await ref.update({ status: 'sent', to: email, sentAt: FieldValue.serverTimestamp(), error: FieldValue.delete() });
  return 'sent';
}

export const sendMail = onDocumentCreated(
  {
    document: 'mail/{id}',
    region: 'us-central1',
    retry: true,
    maxInstances: 2,
    secrets: [UNSUBSCRIBE_SECRET],
  },
  async (event) => {
    await handleMailCreated(event.params.id);
  },
);
