/**
 * Function unit tests for the teamProposal callable (spec 009 AC-4 – AC-9).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import functionsTest from 'firebase-functions-test';
import {
  adminDb,
  callableRequest,
  clearAuth,
  clearFirestore,
  loadTeamProposal,
  seedUser,
} from './_helpers.js';

const fft = functionsTest({ projectId: process.env['GCLOUD_PROJECT'] ?? 'citl-fn-test' });
let wrapped: ReturnType<typeof fft.wrap>;

const USER = 'uCaptain';
const OTHER = 'uOther';
const YEAR = new Date().getUTCFullYear();
const ID = `${YEAR}_${USER}`;

beforeAll(async () => {
  const mod = await loadTeamProposal();
  wrapped = fft.wrap(mod.teamProposal);
});

afterAll(() => {
  fft.cleanup();
});

async function seedMember(uid: string, extras: Record<string, unknown> = {}): Promise<void> {
  await seedUser(uid, 'user', { status: 'active', ...extras });
  await adminDb().doc(`profiles/${uid}`).set({
    firstName: 'Pat', lastName: uid, displayName: `Pat ${uid}`, termsVersion: '2026-10', adultAttested: true,
  });
}

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
  await seedMember(USER);
  await seedMember(OTHER);
  await adminDb().doc(`profiles/${USER}/dependents/d1`).set({ firstName: 'Sam', lastName: 'doe', birthYear: YEAR - 12 });
  await adminDb().doc('leagueTeams/crazy-guns').set({ name: 'Crazy Guns', captainUid: null, seasons: [YEAR - 1] });
});

function call(uid: string | null, data: unknown) {
  return wrapped(callableRequest({ uid, role: 'user', data }));
}

type Entry = Record<string, unknown>;
const self: Entry = { kind: 'self', rookie: false };
const named = (first: string, last: string, extra: Entry = {}): Entry =>
  ({ kind: 'named', firstName: first, lastName: last, rookie: false, minor: false, ...extra });
const fourOthers = [named('Al', 'One'), named('Bo', 'Two'), named('Cy', 'Three'), named('Di', 'Four')];

function save(extra: Entry = {}): Entry {
  return {
    action: 'save', year: YEAR, teamSource: 'new', leagueTeamId: null, teamName: 'Clay Busters',
    shooters: [self, ...fourOthers], ...extra,
  };
}

async function proposal(): Promise<Record<string, unknown> | undefined> {
  return (await adminDb().doc(`teamProposals/${ID}`).get()).data();
}

async function auditActions(): Promise<unknown[]> {
  return (await adminDb().collection('audit').get()).docs.map((d) => d.data()['action']);
}

describe('rejections', () => {
  it('rejects unauthenticated and malformed calls', async () => {
    await expect(call(null, save())).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(call(USER, { action: 'nope', year: YEAR })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(call(USER, save({ teamName: 'x' }))).rejects.toMatchObject({ code: 'invalid-argument' });
    for (const leagueTeamId of ['.', '..', '__x__']) {
      await expect(call(USER, save({ teamSource: 'returning', leagueTeamId })))
        .rejects.toMatchObject({ code: 'invalid-argument' });
    }
  });

  it('rejects a year outside this year and next', async () => {
    await expect(call(USER, save({ year: YEAR - 1 }))).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(call(USER, save({ year: YEAR + 2 }))).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects a deactivated member and one without a profile', async () => {
    await adminDb().doc(`users/${USER}`).update({ status: 'deactivated' });
    await expect(call(USER, save())).rejects.toMatchObject({ details: { reason: 'not-eligible' } });
    await adminDb().doc(`users/${USER}`).update({ status: 'active' });
    await adminDb().doc(`profiles/${USER}`).delete();
    await expect(call(USER, save())).rejects.toMatchObject({ details: { reason: 'not-eligible' } });
  });

  it('rejects when the member registered individually for the season', async () => {
    await adminDb().doc(`registrations/${ID}`).set({ uid: USER, year: YEAR, status: 'submitted' });
    await expect(call(USER, save())).rejects.toMatchObject({
      code: 'failed-precondition', details: { reason: 'has-registration' },
    });
  });

  it('rejects a returning team that has another captain', async () => {
    await adminDb().doc('leagueTeams/crazy-guns').update({ captainUid: OTHER });
    await expect(call(USER, save({ teamSource: 'returning', leagueTeamId: 'crazy-guns', teamName: 'Crazy Guns' })))
      .rejects.toMatchObject({ code: 'permission-denied', details: { reason: 'team-has-captain' } });
  });

  it('rejects a returning team that does not exist', async () => {
    await expect(call(USER, save({ teamSource: 'returning', leagueTeamId: 'ghosts', teamName: 'Ghosts' })))
      .rejects.toMatchObject({ code: 'not-found' });
  });

  it('rejects a new team whose name matches a league team', async () => {
    await expect(call(USER, save({ teamName: '  Crazy   Guns ' })))
      .rejects.toMatchObject({ code: 'already-exists', details: { reason: 'league-team-exists' } });
  });

  it('rejects roster rule violations with their reason', async () => {
    const sixteen = Array.from({ length: 16 }, (_, i) => named('Shooter', `N${String.fromCharCode(65 + i)}`));
    const cases: [Entry[], string][] = [
      [sixteen, 'roster-too-long'],
      [[self, named('Al', 'One'), named('al', 'one')], 'duplicate-name'],
      [[self, self], 'self-count'],
      [[self, named('Kid', 'One', { minor: true })], 'guardian-required'],
      [[self, named('Kid', 'One', { minor: true, guardianName: 'Nobody Here' })], 'guardian-not-adult'],
      [[self, named('Kid', 'One', { minor: true, guardianName: 'Sam D.' }), { kind: 'dependent', dependentId: 'd1', rookie: true }], 'guardian-not-adult'],
      [[self, { kind: 'dependent', dependentId: 'nope', rookie: false }], 'unknown-dependent'],
    ];
    for (const [shooters, reason] of cases) {
      await expect(call(USER, save({ shooters })), reason)
        .rejects.toMatchObject({ code: 'invalid-argument', details: { reason } });
    }
  });

  it("rejects another member's dependent", async () => {
    await adminDb().doc(`profiles/${OTHER}/dependents/d9`).set({ firstName: 'Lee', lastName: 'Roe', birthYear: YEAR - 10 });
    await expect(call(USER, save({ shooters: [self, { kind: 'dependent', dependentId: 'd9', rookie: false }] })))
      .rejects.toMatchObject({ details: { reason: 'unknown-dependent' } });
  });

  it('rejects the 61st call in an hour', async () => {
    await adminDb().doc(`rateLimits/teamProposal/actors/${USER}`).set({ windowStart: Date.now(), count: 60 });
    await expect(call(USER, save())).rejects.toMatchObject({ code: 'resource-exhausted' });
  });
});

describe('save', () => {
  it('creates a draft with server-resolved names', async () => {
    const res = await call(USER, save({
      shooters: [
        self,
        { kind: 'dependent', dependentId: 'd1', rookie: true },
        named('Kim', 'lee-Ray', { minor: true, guardianName: 'Al One' }),
        ...fourOthers,
      ],
    }));
    expect(res).toEqual({ ok: true, status: 'draft' });
    const p = await proposal();
    expect(p).toMatchObject({
      captainUid: USER, year: YEAR, purpose: 'initial', teamSource: 'new', leagueTeamId: null,
      teamName: 'Clay Busters', status: 'draft', submittedAt: null,
    });
    const names = (p?.['shooters'] as { name: string }[]).map((s) => s.name);
    expect(names).toEqual([`Pat ${USER}`, 'Sam D.', 'Kim L.', 'Al One', 'Bo Two', 'Cy Three', 'Di Four']);
    expect((p?.['shooters'] as Entry[])[1]).toMatchObject({ kind: 'dependent', minor: true, dependentId: 'd1', rookie: true });
    expect((p?.['shooters'] as Entry[])[2]).toMatchObject({ minor: true, guardianName: 'Al One' });
  });

  it('uses the approved shooter link name for the captain when present', async () => {
    await adminDb().doc(`shooterLinks/${USER}`).set({ shooterName: 'Patrick Q. Shooter' });
    await call(USER, save());
    expect(((await proposal())?.['shooters'] as { name: string }[])[0]?.name).toBe('Patrick Q. Shooter');
  });

  it('replaces the draft on a second save and keeps createdAt', async () => {
    await call(USER, save());
    const first = await proposal();
    await call(USER, save({ teamName: 'Clay Busters II', shooters: [self] }));
    const second = await proposal();
    expect(second?.['teamName']).toBe('Clay Busters II');
    expect((second?.['shooters'] as unknown[]).length).toBe(1);
    expect(second?.['createdAt']).toEqual(first?.['createdAt']);
  });

  it("claims a returning team with no captain, and the captain's own team", async () => {
    await expect(call(USER, save({ teamSource: 'returning', leagueTeamId: 'crazy-guns', teamName: 'Crazy Guns' })))
      .resolves.toEqual({ ok: true, status: 'draft' });
    await adminDb().doc('leagueTeams/crazy-guns').update({ captainUid: USER });
    await expect(call(USER, save({ teamSource: 'returning', leagueTeamId: 'crazy-guns', teamName: 'Crazy Guns' })))
      .resolves.toEqual({ ok: true, status: 'draft' });
    expect((await proposal())?.['leagueTeamId']).toBe('crazy-guns');
  });

  it('accepts next year', async () => {
    await expect(call(USER, save({ year: YEAR + 1 }))).resolves.toEqual({ ok: true, status: 'draft' });
    expect((await adminDb().doc(`teamProposals/${YEAR + 1}_${USER}`).get()).exists).toBe(true);
  });
});

describe('submit, withdraw, delete', () => {
  it('submit rejects fewer than 5 shooters and a roster without the captain', async () => {
    await call(USER, save({ shooters: [self, named('Al', 'One')] }));
    await expect(call(USER, { action: 'submit', year: YEAR }))
      .rejects.toMatchObject({ details: { reason: 'roster-too-short' } });
    await call(USER, save({ shooters: [...fourOthers, named('Ed', 'Five')] }));
    await expect(call(USER, { action: 'submit', year: YEAR }))
      .rejects.toMatchObject({ details: { reason: 'self-count' } });
  });

  it('submit sets submitted, submittedAt, and one audit entry; save is then rejected', async () => {
    await call(USER, save());
    await expect(call(USER, { action: 'submit', year: YEAR })).resolves.toEqual({ ok: true, status: 'submitted' });
    const p = await proposal();
    expect(p?.['status']).toBe('submitted');
    expect(p?.['submittedAt']).not.toBeNull();
    expect(await auditActions()).toEqual(['submitted']);
    const audit = (await adminDb().collection('audit').get()).docs[0]?.data();
    expect(audit).toMatchObject({ kind: 'proposal', actorUid: USER, subjectId: ID });
    await expect(call(USER, save())).rejects.toMatchObject({ details: { reason: 'bad-status' } });
    await expect(call(USER, { action: 'submit', year: YEAR })).rejects.toMatchObject({ details: { reason: 'bad-status' } });
  });

  it('submit re-resolves the captain and dependent names', async () => {
    await call(USER, save({ shooters: [self, { kind: 'dependent', dependentId: 'd1', rookie: false }, ...fourOthers] }));
    await adminDb().doc(`profiles/${USER}`).update({ displayName: 'Patricia Captain' });
    await adminDb().doc(`profiles/${USER}/dependents/d1`).update({ firstName: 'Samuel' });
    await call(USER, { action: 'submit', year: YEAR });
    const names = ((await proposal())?.['shooters'] as { name: string }[]).map((s) => s.name);
    expect(names.slice(0, 2)).toEqual(['Patricia Captain', 'Samuel D.']);
  });

  it('submit rejects when a dependent was removed, or the returning team gained another captain', async () => {
    await call(USER, save({ shooters: [self, { kind: 'dependent', dependentId: 'd1', rookie: false }, ...fourOthers] }));
    await adminDb().doc(`profiles/${USER}/dependents/d1`).delete();
    await expect(call(USER, { action: 'submit', year: YEAR }))
      .rejects.toMatchObject({ details: { reason: 'unknown-dependent' } });

    await call(USER, save({ teamSource: 'returning', leagueTeamId: 'crazy-guns', teamName: 'Crazy Guns' }));
    await adminDb().doc('leagueTeams/crazy-guns').update({ captainUid: OTHER });
    await expect(call(USER, { action: 'submit', year: YEAR }))
      .rejects.toMatchObject({ details: { reason: 'team-has-captain' } });
  });

  it('withdraw returns a submitted proposal to draft and audits; only from submitted', async () => {
    await call(USER, save());
    await expect(call(USER, { action: 'withdraw', year: YEAR })).rejects.toMatchObject({ details: { reason: 'bad-status' } });
    await call(USER, { action: 'submit', year: YEAR });
    await expect(call(USER, { action: 'withdraw', year: YEAR })).resolves.toEqual({ ok: true, status: 'draft' });
    expect((await proposal())?.['status']).toBe('draft');
    expect(await auditActions()).toEqual(expect.arrayContaining(['submitted', 'withdrawn']));
  });

  it('delete removes a draft or rejected proposal, not a submitted one', async () => {
    await expect(call(USER, { action: 'delete', year: YEAR })).rejects.toMatchObject({ code: 'not-found' });
    await call(USER, save());
    await call(USER, { action: 'submit', year: YEAR });
    await expect(call(USER, { action: 'delete', year: YEAR })).rejects.toMatchObject({ details: { reason: 'bad-status' } });
    await adminDb().doc(`teamProposals/${ID}`).update({ status: 'rejected' });
    await expect(call(USER, { action: 'delete', year: YEAR })).resolves.toEqual({ ok: true, status: null });
    expect(await proposal()).toBeUndefined();
    expect(await auditActions()).toEqual(expect.arrayContaining(['submitted', 'deleted']));
  });

  it('approved proposals can be neither edited nor deleted', async () => {
    await call(USER, save());
    await adminDb().doc(`teamProposals/${ID}`).update({ status: 'approved' });
    await expect(call(USER, save())).rejects.toMatchObject({ details: { reason: 'bad-status' } });
    await expect(call(USER, { action: 'delete', year: YEAR })).rejects.toMatchObject({ details: { reason: 'bad-status' } });
  });
});
