/**
 * Function tests for the captainHandoff callable (spec 010 AC-17, AC-18),
 * plus the deleteAccount nomination cascade (AC-21).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import functionsTest from 'firebase-functions-test';
import {
  adminDb,
  callableRequest,
  clearAuth,
  clearFirestore,
  loadCaptainHandoff,
  loadDeleteAccount,
  mailDocs,
  seedUser,
} from './_helpers.js';

const fft = functionsTest({ projectId: process.env['GCLOUD_PROJECT'] ?? 'citl-fn-test' });
let wrapped: ReturnType<typeof fft.wrap>;
let deleteAccount: ReturnType<typeof fft.wrap>;

const CAPTAIN = 'uCaptain';
const NOMINEE = 'uNominee';
const OTHER = 'uOther';

beforeAll(async () => {
  wrapped = fft.wrap((await loadCaptainHandoff()).captainHandoff);
  deleteAccount = fft.wrap((await loadDeleteAccount()).deleteAccount);
});

afterAll(() => {
  fft.cleanup();
});

async function seedMember(uid: string, extras: Record<string, unknown> = {}): Promise<void> {
  await seedUser(uid, 'user', { status: 'active', ...extras });
  await adminDb().doc(`profiles/${uid}`).set({ displayName: `Pat ${uid}`, termsVersion: '2026-10', adultAttested: true });
}

const call = (uid: string, data: unknown) => wrapped(callableRequest({ uid, role: 'user', data }));
const nominate = (email = `${NOMINEE}@example.com`, uid = CAPTAIN) =>
  call(uid, { action: 'nominate', leagueTeamId: 'crazy-guns', email });
const change = async () => (await adminDb().doc('captainChanges/crazy-guns').get()).data();
/** Queued status mail as sorted "uid: subject" lines (spec 011). */
const mailOut = async () => (await mailDocs()).map((m) => `${m['uid']}: ${m['subject']}`).sort();

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
  await seedMember(CAPTAIN);
  await seedMember(NOMINEE);
  await seedMember(OTHER);
  await adminDb().doc('leagueTeams/crazy-guns').set({ name: 'Crazy Guns', captainUid: CAPTAIN, seasons: [2026] });
});

describe('nominate', () => {
  it('creates a nomination by email, case-insensitively, and audits', async () => {
    await expect(nominate(`${NOMINEE.toUpperCase()}@EXAMPLE.COM`))
      .resolves.toEqual({ ok: true, status: 'nominated', toName: `Pat ${NOMINEE}` });
    expect(await change()).toMatchObject({
      leagueTeamId: 'crazy-guns', teamName: 'Crazy Guns', fromUid: CAPTAIN, toUid: NOMINEE, status: 'nominated',
    });
    const audit = (await adminDb().collection('audit').get()).docs.map((d) => d.data());
    expect(audit).toEqual([expect.objectContaining({ kind: 'captain', action: 'nominated', targetUid: NOMINEE })]);
    expect(await mailOut()).toEqual([`${NOMINEE}: You're nominated as captain of Crazy Guns`]);
  });

  it('rejects each failure reason', async () => {
    await expect(nominate('nobody@example.com')).rejects.toMatchObject({ details: { reason: 'no-member' } });
    expect(await mailOut()).toEqual([]);
    await expect(nominate(`${CAPTAIN}@example.com`)).rejects.toMatchObject({ details: { reason: 'self-nomination' } });
    await expect(nominate(`${NOMINEE}@example.com`, OTHER)).rejects.toMatchObject({ details: { reason: 'not-captain' } });
    await expect(call(CAPTAIN, { action: 'nominate', leagueTeamId: 'crazy-guns', email: 'not-an-email' }))
      .rejects.toMatchObject({ code: 'invalid-argument' });

    await adminDb().doc(`users/${NOMINEE}`).update({ status: 'deactivated' });
    await expect(nominate()).rejects.toMatchObject({ details: { reason: 'not-eligible' } });
    await adminDb().doc(`users/${NOMINEE}`).update({ status: 'active' });

    await adminDb().doc('leagueTeams/other-team').set({ name: 'Other', captainUid: NOMINEE, seasons: [] });
    await expect(nominate()).rejects.toMatchObject({ details: { reason: 'already-captain' } });
    await adminDb().doc('leagueTeams/other-team').delete();

    await nominate();
    await expect(nominate(`${OTHER}@example.com`)).rejects.toMatchObject({ details: { reason: 'handoff-open' } });
  });

  it('a new nomination replaces a closed one', async () => {
    await nominate();
    await call(NOMINEE, { action: 'decline', leagueTeamId: 'crazy-guns' });
    await expect(nominate(`${OTHER}@example.com`)).resolves.toMatchObject({ status: 'nominated' });
    expect((await change())?.['toUid']).toBe(OTHER);
  });
});

describe('respond and cancel', () => {
  beforeEach(async () => { await nominate(); });

  it('the nominee accepts; only the nominee can respond, once', async () => {
    await expect(call(OTHER, { action: 'accept', leagueTeamId: 'crazy-guns' })).rejects.toMatchObject({ details: { reason: 'not-nominee' } });
    await expect(call(NOMINEE, { action: 'accept', leagueTeamId: 'crazy-guns' })).resolves.toEqual({ ok: true, status: 'accepted' });
    expect((await change())?.['respondedAt']).not.toBeNull();
    await expect(call(NOMINEE, { action: 'decline', leagueTeamId: 'crazy-guns' })).rejects.toMatchObject({ details: { reason: 'bad-status' } });
    // Accepting does not move the captaincy; the coordinator approves.
    expect((await adminDb().doc('leagueTeams/crazy-guns').get()).data()?.['captainUid']).toBe(CAPTAIN);
    expect(await mailOut()).toContain(`${CAPTAIN}: Pat ${NOMINEE} accepted the Crazy Guns captaincy`);
  });

  it('the nominee declines and the captain is told', async () => {
    await call(NOMINEE, { action: 'decline', leagueTeamId: 'crazy-guns' });
    expect(await mailOut()).toContain(`${CAPTAIN}: Pat ${NOMINEE} declined the Crazy Guns captaincy`);
  });

  it('the captain cancels an open handoff; others cannot', async () => {
    await expect(call(NOMINEE, { action: 'cancel', leagueTeamId: 'crazy-guns' })).rejects.toMatchObject({ details: { reason: 'not-captain' } });
    await expect(call(CAPTAIN, { action: 'cancel', leagueTeamId: 'crazy-guns' })).resolves.toEqual({ ok: true, status: 'cancelled' });
    expect(await mailOut()).toContain(`${NOMINEE}: Captain nomination for Crazy Guns cancelled`);
    await expect(call(CAPTAIN, { action: 'cancel', leagueTeamId: 'crazy-guns' })).rejects.toMatchObject({ details: { reason: 'bad-status' } });
    await expect(call(CAPTAIN, { action: 'cancel', leagueTeamId: 'ghosts' })).rejects.toMatchObject({ details: { reason: 'no-handoff' } });
  });

  it('deleting the nominee account removes the nomination', async () => {
    await deleteAccount(callableRequest({ uid: NOMINEE, role: 'user', data: { confirm: 'DELETE' } }));
    expect(await change()).toBeUndefined();
  });
});
