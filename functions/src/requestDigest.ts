/**
 * requestDigest — one morning email to admins about new league requests
 * (spec 011 AC-19, DD-7).
 *
 * Reads the four queue queries the Requests tab uses, keeps items updated
 * since config/mailDigest.lastRunAt (first run: the last 24 hours), and,
 * when any remain, queues one digest per admin or owner subscribed to the
 * `requests` topic. Then records the run. Quiet days send nothing.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, type QuerySnapshot } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { queueMail } from './lib/mailQueue.js';
import { digestContent, type DigestCounts } from './mail/builders.js';

if (getApps().length === 0) {
  initializeApp();
}

const DAY_MS = 24 * 60 * 60 * 1000;
const QUEUE_LIMIT = 200;

function countSince(snap: QuerySnapshot, since: number): number {
  return snap.docs.filter((d) => {
    const updated = d.data()['updatedAt'];
    return updated instanceof Timestamp && updated.toMillis() > since;
  }).length;
}

/** Returns the number of digests queued. */
export async function handleRequestDigest(now: number = Date.now()): Promise<number> {
  const db = getFirestore();
  const stateRef = db.doc('config/mailDigest');
  const last = (await stateRef.get()).data()?.['lastRunAt'];
  const since = last instanceof Timestamp ? last.toMillis() : now - DAY_MS;

  const queue = (collection: string, status: string) =>
    db.collection(collection).where('status', '==', status).limit(QUEUE_LIMIT).get();
  const [proposals, registrations, links, captains] = await Promise.all([
    queue('teamProposals', 'submitted'),
    queue('registrations', 'submitted'),
    queue('shooterLinkRequests', 'submitted'),
    queue('captainChanges', 'accepted'),
  ]);
  const counts: DigestCounts = {
    proposals: countSince(proposals, since),
    registrations: countSince(registrations, since),
    links: countSince(links, since),
    captains: countSince(captains, since),
  };
  const total = counts.proposals + counts.registrations + counts.links + counts.captains;

  let queued = 0;
  if (total > 0) {
    const subscribed = await db.collection('notificationSettings').where('topics.requests', '==', true).limit(50).get();
    const users = subscribed.empty ? [] : await db.getAll(...subscribed.docs.map((d) => db.doc(`users/${d.id}`)));
    const admins = users.filter((u) => ['admin', 'owner'].includes(String(u.data()?.['role'])));
    if (admins.length > 0) {
      await db.runTransaction(async (tx) => {
        for (const admin of admins) queueMail(tx, db, admin.id, digestContent(counts), 'digest');
      });
      queued = admins.length;
    }
  }
  await stateRef.set({ lastRunAt: Timestamp.fromMillis(now) });
  return queued;
}

export const requestDigest = onSchedule(
  { schedule: '0 7 * * *', timeZone: 'America/Chicago', region: 'us-central1', retryCount: 1 },
  async () => {
    await handleRequestDigest();
  },
);
