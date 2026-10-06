/**
 * Function tests for topic emails (spec 011 AC-11 – AC-14): fan-out,
 * the three triggers' guards, and the schedule change lines.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { adminDb, clearFirestore, loadTopicEmails, mailDocs } from './_helpers.js';

let t: Awaited<ReturnType<typeof loadTopicEmails>>;
const NOW = Date.now();
const YEAR = new Date(NOW).getUTCFullYear();

beforeAll(async () => { t = await loadTopicEmails(); });

async function member(uid: string, topics: Record<string, boolean>, extras: Record<string, unknown> = {}) {
  await adminDb().doc(`users/${uid}`).set({ uid, email: `${uid}@example.com`, status: 'active', ...extras });
  await adminDb().doc(`notificationSettings/${uid}`).set({ topics });
}

beforeEach(async () => {
  await clearFirestore();
  await member('uA', { news: true, scores: true, schedule: true });
  await member('uB', { news: true, scores: false });
  await member('uOff', { news: true }, { status: 'deactivated' });
  await member('uNoMail', { news: true }, { email: null });
  await adminDb().doc(`seasons/${YEAR}`).set({ year: YEAR, status: 'active', currentWeek: 3 });
});

describe('news (onAnnouncementCreated)', () => {
  const ann = { year: YEAR, title: 'Banquet', body: 'Saturday at 6.\n\nBring a dish.', email: true };

  it('queues one mail per active subscriber, once per announcement', async () => {
    await expect(t.handleAnnouncementCreated('a1', ann, NOW)).resolves.toBe(2);
    await expect(t.handleAnnouncementCreated('a1', ann, NOW)).resolves.toBeNull();
    const mail = await mailDocs();
    expect(mail.map((m) => m['uid']).sort()).toEqual(['uA', 'uB']);
    expect(mail[0]).toMatchObject({
      kind: 'news', topic: 'news', status: 'pending', subject: 'Banquet', paragraphs: ['Saturday at 6.', 'Bring a dish.'],
    });
    expect(mail[0]?.['expireAt']).toBeDefined();
    expect((await adminDb().doc('notifications/news_a1').get()).data()).toMatchObject({ recipients: 2 });
  });

  it('sends nothing without the checkbox or for another year', async () => {
    await expect(t.handleAnnouncementCreated('a2', { ...ann, email: false }, NOW)).resolves.toBeNull();
    await expect(t.handleAnnouncementCreated('a3', { ...ann, year: YEAR - 1 }, NOW)).resolves.toBeNull();
    expect(await mailDocs()).toHaveLength(0);
  });
});

describe('scores (onWeekPublished)', () => {
  const week = {
    publishedAt: new Date(NOW).toISOString(),
    teamResults: [
      { teamName: 'Low', targets: 300 }, { teamName: 'High', targets: 420 },
      { teamName: 'Mid', targets: 390 }, { teamName: 'Mid2', targets: 380 },
    ],
  };

  it('queues the top three teams to scores subscribers once', async () => {
    await expect(t.handleWeekPublished(YEAR, 4, week, NOW)).resolves.toBe(1);
    await expect(t.handleWeekPublished(YEAR, 4, week, NOW)).resolves.toBeNull();
    const [mail] = await mailDocs();
    expect(mail).toMatchObject({ uid: 'uA', subject: 'Week 4 results are posted' });
    expect(String((mail?.['paragraphs'] as string[])[1])).toBe('Top teams this week:\n1. High: 420\n2. Mid: 390\n3. Mid2: 380');
  });

  it('skips a stale publishedAt, a past year, and a completed season', async () => {
    await expect(t.handleWeekPublished(YEAR, 5, { ...week, publishedAt: new Date(NOW - 2 * 86_400_000).toISOString() }, NOW)).resolves.toBeNull();
    await expect(t.handleWeekPublished(YEAR - 1, 5, week, NOW)).resolves.toBeNull();
    await adminDb().doc(`seasons/${YEAR}`).update({ status: 'complete' });
    await expect(t.handleWeekPublished(YEAR, 5, week, NOW)).resolves.toBeNull();
    expect(await mailDocs()).toHaveLength(0);
  });

  it('treats a season with no status (created by an approval) as open', async () => {
    await adminDb().doc(`seasons/${YEAR}`).set({ year: YEAR });
    await expect(t.handleWeekPublished(YEAR, 1, week, NOW)).resolves.toBe(1);
  });
});

describe('schedule (onSeasonUpdated)', () => {
  const before = { currentWeek: 3, weekDateOverrides: { '2': '2026-05-12', '6': null } };

  it('builds one email for every changed future week, keyed by event', async () => {
    const after = { currentWeek: 3, weekDateOverrides: { '2': '2026-05-19', '5': '2026-06-10', '7': null } };
    await expect(t.handleSeasonUpdated('e1', YEAR, before, after, NOW)).resolves.toBe(1);
    await expect(t.handleSeasonUpdated('e1', YEAR, before, after, NOW)).resolves.toBeNull();
    const [mail] = await mailDocs();
    expect(mail).toMatchObject({ uid: 'uA', kind: 'schedule', subject: 'Schedule changes' });
    expect((mail?.['paragraphs'] as string[])[1]).toBe(
      'Week 5 moves to Wed, Jun 10.\nWeek 6 is back on its regular date.\nWeek 7 is cancelled.',
    );
  });

  it('sends nothing for unchanged overrides, past weeks only, or other fields', async () => {
    await expect(t.handleSeasonUpdated('e2', YEAR, before, { ...before, standings: [1] }, NOW)).resolves.toBeNull();
    await expect(t.handleSeasonUpdated('e3', YEAR, before, { ...before, weekDateOverrides: { '2': '2026-05-26', '6': null } }, NOW)).resolves.toBeNull();
    await expect(t.handleSeasonUpdated('e4', YEAR - 1, before, { currentWeek: 3, weekDateOverrides: {} }, NOW)).resolves.toBeNull();
    expect(await mailDocs()).toHaveLength(0);
  });

  it('names a single change in the subject', () => {
    const changes = t.scheduleChanges({}, { '9': null }, 3);
    expect(t.scheduleContent(YEAR, changes).subject).toBe('Schedule change: week 9');
  });
});
