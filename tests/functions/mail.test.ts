/**
 * Function tests for the mail core (spec 011 AC-4 – AC-10): unsubscribe
 * tokens, templates, sendMail with a fake transport, and the unsubscribe
 * endpoint.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, clearFirestore, fakeTransport, loadMail, queueTestMail } from './_helpers.js';

const SECRET = process.env['UNSUBSCRIBE_SECRET'] ?? '';
let m: Awaited<ReturnType<typeof loadMail>>;
let fake: ReturnType<typeof fakeTransport>;

beforeAll(async () => { m = await loadMail(); });
afterAll(() => { m.setTransportForTests(null); });

beforeEach(async () => {
  await clearFirestore();
  fake = fakeTransport();
  m.setTransportForTests(fake.transport);
  await adminDb().doc('users/uA').set({ uid: 'uA', email: 'a@example.com', status: 'active' });
});

const mailDoc = async (id: string) => (await adminDb().doc(`mail/${id}`).get()).data();

describe('unsubscribe tokens', () => {
  it('verifies its own signature and rejects any change', () => {
    const sig = m.signUnsubscribe(SECRET, 'uA', 'news');
    expect(m.verifyUnsubscribe(SECRET, 'uA', 'news', sig)).toBe(true);
    expect(m.verifyUnsubscribe(SECRET, 'uB', 'news', sig)).toBe(false);
    expect(m.verifyUnsubscribe(SECRET, 'uA', 'scores', sig)).toBe(false);
    expect(m.verifyUnsubscribe(SECRET, 'uA', 'news', `${sig}x`)).toBe(false);
    expect(m.verifyUnsubscribe('other', 'uA', 'news', sig)).toBe(false);
    expect(m.verifyUnsubscribe(SECRET, 'uA', 'bogus', sig)).toBe(false);
  });
});

describe('templates', () => {
  it('escapes content and carries the topic footer', () => {
    const r = m.renderMail(
      { subject: 'A <b>&', paragraphs: ['x < y'], link: { label: 'Standings', path: '/#/standings' } },
      { kind: 'topic', topic: 'scores', unsubscribeUrl: 'https://citl.club/unsubscribe?u=1&t=scores&s=z' },
    );
    expect(r.html).toContain('A &lt;b&gt;&amp;');
    expect(r.html).toContain('x &lt; y');
    expect(r.html).not.toContain('<b>');
    expect(r.html).toContain('href="https://citl.club/#/standings"');
    expect(r.html).toContain('u=1&amp;t=scores&amp;s=z');
    expect(r.text).toContain('Standings: https://citl.club/#/standings');
    expect(r.text).toContain('Unsubscribe: https://citl.club/unsubscribe?u=1&t=scores&s=z');
  });

  it('account footer has no unsubscribe link', () => {
    const r = m.renderMail({ subject: 'S', paragraphs: ['p'] }, { kind: 'account' });
    expect(r.text).not.toContain('Unsubscribe');
    expect(r.text).toContain('https://citl.club/#/account');
  });
});

describe('sendMail', () => {
  it('sends status mail without unsubscribe headers and records it', async () => {
    await queueTestMail('m1', { uid: 'uA', kind: 'status' });
    await expect(m.handleMailCreated('m1')).resolves.toBe('sent');
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]).toMatchObject({ to: 'a@example.com', subject: 'Hello' });
    expect(fake.sent[0]?.headers).toBeUndefined();
    expect(await mailDoc('m1')).toMatchObject({ status: 'sent', to: 'a@example.com', attempts: 1 });
  });

  it('sends topic mail with one-click unsubscribe headers when the topic is on', async () => {
    await adminDb().doc('notificationSettings/uA').set({ topics: { scores: true } });
    await queueTestMail('m1', { uid: 'uA', kind: 'scores', topic: 'scores' });
    await expect(m.handleMailCreated('m1')).resolves.toBe('sent');
    const headers = fake.sent[0]?.headers ?? {};
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    const url = new URL(String(headers['List-Unsubscribe']).slice(1, -1));
    expect(url.pathname).toBe('/unsubscribe');
    expect(m.verifyUnsubscribe(SECRET, url.searchParams.get('u') ?? '', 'scores', url.searchParams.get('s') ?? '')).toBe(true);
  });

  it('skips a topic that is off, a deactivated member, and a missing account', async () => {
    await queueTestMail('m1', { uid: 'uA', kind: 'news', topic: 'news' });
    await expect(m.handleMailCreated('m1')).resolves.toBe('skipped');
    expect(await mailDoc('m1')).toMatchObject({ status: 'skipped', error: 'topic-off' });

    await adminDb().doc('users/uA').update({ status: 'deactivated' });
    await queueTestMail('m2', { uid: 'uA', kind: 'status' });
    await expect(m.handleMailCreated('m2')).resolves.toBe('skipped');

    await queueTestMail('m3', { uid: 'uGone', kind: 'status' });
    await expect(m.handleMailCreated('m3')).resolves.toBe('skipped');
    expect(fake.sent).toHaveLength(0);
  });

  it('ignores a doc already sent or freshly claimed, and reclaims a stale claim', async () => {
    await queueTestMail('m1', { uid: 'uA', kind: 'status', status: 'sent' });
    await expect(m.handleMailCreated('m1')).resolves.toBe('ignored');
    await queueTestMail('m2', { uid: 'uA', kind: 'status', status: 'sending', claimedAt: Timestamp.now() });
    await expect(m.handleMailCreated('m2')).resolves.toBe('ignored');
    await queueTestMail('m3', { uid: 'uA', kind: 'status', status: 'sending', claimedAt: Timestamp.fromMillis(Date.now() - 11 * 60_000) });
    await expect(m.handleMailCreated('m3')).resolves.toBe('sent');
    expect(fake.sent).toHaveLength(1);
  });

  it('rethrows a retryable error until the last attempt, then fails', async () => {
    fake.state.fail = new m.RetryableMailError('Throttling');
    await queueTestMail('m1', { uid: 'uA', kind: 'status' });
    await expect(m.handleMailCreated('m1')).rejects.toThrow('Throttling');
    expect(await mailDoc('m1')).toMatchObject({ status: 'pending', attempts: 1 });
    await adminDb().doc('mail/m1').update({ attempts: 4 });
    await expect(m.handleMailCreated('m1')).resolves.toBe('failed');
    expect(await mailDoc('m1')).toMatchObject({ status: 'failed', attempts: 5, error: 'Throttling' });
  });

  it('marks a permanent error failed without retrying', async () => {
    fake.state.fail = new Error('MessageRejected');
    await queueTestMail('m1', { uid: 'uA', kind: 'status' });
    await expect(m.handleMailCreated('m1')).resolves.toBe('failed');
    expect(await mailDoc('m1')).toMatchObject({ status: 'failed', error: 'MessageRejected' });
  });
});

describe('unsubscribe endpoint', () => {
  const query = (topic = 'news', uid = 'uA') => ({ u: uid, t: topic, s: m.signUnsubscribe(SECRET, uid, topic as 'news') });

  it('GET shows a confirm form and changes nothing', async () => {
    await adminDb().doc('notificationSettings/uA').set({ topics: { news: true } });
    const out = await m.handleUnsubscribe({ method: 'GET', query: query() });
    expect(out.status).toBe(200);
    expect(out.html).toContain('<form method="post"');
    expect((await adminDb().doc('notificationSettings/uA').get()).data()).toMatchObject({ topics: { news: true } });
  });

  it('POST turns the topic off and keeps the others; repeating is harmless', async () => {
    await adminDb().doc('notificationSettings/uA').set({ topics: { news: true, scores: true } });
    for (let i = 0; i < 2; i += 1) {
      const out = await m.handleUnsubscribe({ method: 'POST', query: query() });
      expect(out.status).toBe(200);
    }
    expect((await adminDb().doc('notificationSettings/uA').get()).data()).toMatchObject({ topics: { news: false, scores: true } });
  });

  it('rejects a bad signature, an unknown topic, and other methods; writes nothing for a deleted account', async () => {
    expect((await m.handleUnsubscribe({ method: 'POST', query: { ...query(), s: 'bad' } })).status).toBe(400);
    expect((await m.handleUnsubscribe({ method: 'POST', query: { ...query(), t: 'bogus' } })).status).toBe(400);
    expect((await m.handleUnsubscribe({ method: 'DELETE', query: query() })).status).toBe(405);
    expect((await m.handleUnsubscribe({ method: 'POST', query: query('news', 'uGone') })).status).toBe(200);
    expect((await adminDb().doc('notificationSettings/uGone').get()).exists).toBe(false);
    expect((await adminDb().doc('notificationSettings/uA').get()).exists).toBe(false);
  });
});
