/**
 * Function tests for the requestDigest schedule (spec 011 AC-19):
 * counts items updated since the last run, mails subscribed admins only,
 * stays quiet when nothing is new, and records the run.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, clearAuth, clearFirestore, loadRequestDigest, mailDocs, seedUser } from './_helpers.js';

let handleRequestDigest: (now?: number) => Promise<number>;

beforeAll(async () => {
  ({ handleRequestDigest } = await loadRequestDigest());
});

const NOW = Date.UTC(2026, 9, 6, 12);
const HOUR = 60 * 60 * 1000;
const at = (ms: number) => Timestamp.fromMillis(ms);

async function subscribe(uid: string, requests = true): Promise<void> {
  await adminDb().doc(`notificationSettings/${uid}`).set({ topics: { requests }, updatedAt: at(NOW) });
}

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
  await seedUser('uAdmin', 'admin', { status: 'active' });
  await seedUser('uOwner', 'owner', { status: 'active' });
  await seedUser('uMember', 'user', { status: 'active' });
  await subscribe('uAdmin');
  await subscribe('uMember');
  await subscribe('uOwner', false);
});

describe('requestDigest', () => {
  it('mails subscribed admins a count of new requests and records the run', async () => {
    await adminDb().doc('teamProposals/a').set({ status: 'submitted', updatedAt: at(NOW - HOUR) });
    await adminDb().doc('teamProposals/b').set({ status: 'submitted', updatedAt: at(NOW - 2 * HOUR) });
    await adminDb().doc('registrations/c').set({ status: 'submitted', updatedAt: at(NOW - HOUR) });
    await adminDb().doc('captainChanges/d').set({ status: 'accepted', updatedAt: at(NOW - HOUR) });
    // Older than the window, or not waiting on review: not counted.
    await adminDb().doc('shooterLinkRequests/e').set({ status: 'submitted', updatedAt: at(NOW - 30 * HOUR) });
    await adminDb().doc('registrations/f').set({ status: 'placed', updatedAt: at(NOW - HOUR) });

    await expect(handleRequestDigest(NOW)).resolves.toBe(1);
    const mail = await mailDocs();
    expect(mail).toHaveLength(1);
    expect(mail[0]).toMatchObject({ uid: 'uAdmin', kind: 'digest', status: 'pending', subject: '4 new league requests to review' });
    expect(mail[0]?.['paragraphs']).toEqual(['New since the last summary:', '2 team proposals\n1 join request\n1 captain handoff']);
    const state = (await adminDb().doc('config/mailDigest').get()).data();
    expect((state?.['lastRunAt'] as Timestamp).toMillis()).toBe(NOW);
  });

  it('counts only items updated since the last run', async () => {
    await adminDb().doc('config/mailDigest').set({ lastRunAt: at(NOW - HOUR) });
    await adminDb().doc('teamProposals/a').set({ status: 'submitted', updatedAt: at(NOW - 2 * HOUR) });
    await expect(handleRequestDigest(NOW)).resolves.toBe(0);
    expect(await mailDocs()).toEqual([]);
    const state = (await adminDb().doc('config/mailDigest').get()).data();
    expect((state?.['lastRunAt'] as Timestamp).toMillis()).toBe(NOW);
  });

  it('sends nothing when no admin is subscribed', async () => {
    await subscribe('uAdmin', false);
    await adminDb().doc('teamProposals/a').set({ status: 'submitted', updatedAt: at(NOW - HOUR) });
    await expect(handleRequestDigest(NOW)).resolves.toBe(0);
    expect(await mailDocs()).toEqual([]);
  });
});
