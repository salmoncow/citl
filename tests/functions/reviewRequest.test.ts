/**
 * Function tests for the reviewRequest callable (spec 010 AC-6 – AC-13)
 * and the change-request actions of teamProposal (AC-14, AC-15).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import functionsTest from 'firebase-functions-test';
import {
  adminDb,
  callableRequest,
  clearAuth,
  clearFirestore,
  loadReviewRequest,
  loadTeamProposal,
  seedUser,
} from './_helpers.js';

const fft = functionsTest({ projectId: process.env['GCLOUD_PROJECT'] ?? 'citl-fn-test' });
let review: ReturnType<typeof fft.wrap>;
let proposalFn: ReturnType<typeof fft.wrap>;

const ADMIN = 'uAdmin';
const CAPTAIN = 'uCaptain';
const OTHER = 'uOther';
const YEAR = new Date().getUTCFullYear();
const PID = `${YEAR}_${CAPTAIN}`;

beforeAll(async () => {
  review = fft.wrap((await loadReviewRequest()).reviewRequest);
  proposalFn = fft.wrap((await loadTeamProposal()).teamProposal);
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

const db = () => adminDb();
const data = async (path: string) => (await db().doc(path).get()).data();
const roster = (names: string[]) => names.map((name, i) => (i === 0
  ? { kind: 'self', name, rookie: false, minor: false }
  : { kind: 'named', name, rookie: false, minor: false }));
const FIVE = [`Pat ${CAPTAIN}`, 'Al One', 'Bo Two', 'Cy Three', 'Di Four'];
const settings = (names: string[]) => names.map((name) => ({ name, startingAvg: 36, rookie: true }));

async function seedProposal(extra: Record<string, unknown> = {}): Promise<void> {
  await db().doc(`teamProposals/${PID}`).set({
    captainUid: CAPTAIN, year: YEAR, purpose: 'initial', teamSource: 'new', leagueTeamId: null,
    teamName: 'Clay Busters', shooters: roster(FIVE), status: 'submitted', reviewNote: null, ...extra,
  });
}

function asAdmin(payload: unknown) {
  return review(callableRequest({ uid: ADMIN, role: 'admin', data: payload }));
}

function approve(extra: Record<string, unknown> = {}) {
  return asAdmin({ type: 'proposal', id: PID, action: 'approve', settings: settings(FIVE), ...extra });
}

async function auditOf(kind: string): Promise<unknown[]> {
  return (await db().collection('audit').where('kind', '==', kind).get()).docs.map((d) => d.data()['action']);
}

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
  await seedUser(ADMIN, 'admin', { status: 'active' });
  await seedMember(CAPTAIN);
  await seedMember(OTHER);
});

describe('access', () => {
  it('rejects unauthenticated callers, members, and malformed input', async () => {
    await seedProposal();
    await expect(review(callableRequest({ uid: null, data: {} }))).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(review(callableRequest({ uid: CAPTAIN, role: 'user', data: { type: 'proposal', id: PID, action: 'approve' } })))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(asAdmin({ type: 'proposal', id: PID, action: 'publish' })).rejects.toMatchObject({ code: 'invalid-argument' });
    expect((await data(`teamProposals/${PID}`))?.['status']).toBe('submitted');
  });

  it('only reviews a submitted proposal', async () => {
    await seedProposal({ status: 'draft' });
    await expect(approve()).rejects.toMatchObject({ details: { reason: 'bad-status' } });
    await expect(asAdmin({ type: 'proposal', id: 'nope', action: 'reject' })).rejects.toMatchObject({ code: 'not-found' });
  });
});

describe('approve proposal', () => {
  it('publishes a new team: season doc, team doc, league team, proposal, and audit', async () => {
    await seedProposal();
    await expect(approve({ note: 'Welcome' })).resolves.toEqual({ ok: true, status: 'approved' });

    expect(await data(`seasons/${YEAR}`)).toMatchObject({ year: YEAR });
    const team = await data(`seasons/${YEAR}/teams/clay-busters`);
    expect(team).toMatchObject({
      name: 'Clay Busters', captain: `Pat ${CAPTAIN}`, captainUid: CAPTAIN, leagueTeamId: 'clay-busters',
      sourceProposalId: PID, totals: { targets: [], rankPoints: [], bonusPoints: [] },
    });
    expect((team?.['shooters'] as { name: string; startingAvg: number }[]).map((s) => [s.name, s.startingAvg]))
      .toEqual(FIVE.map((n) => [n, 36]));
    expect(await data('leagueTeams/clay-busters')).toMatchObject({ name: 'Clay Busters', captainUid: CAPTAIN, seasons: [YEAR] });
    expect(await data(`teamProposals/${PID}`)).toMatchObject({
      status: 'approved', leagueTeamId: 'clay-busters', reviewNote: 'Welcome', reviewedBy: ADMIN,
    });
    expect(await auditOf('proposal')).toEqual(['approved']);
  });

  it('merges into an existing season team, keeping stored shooters, and claims the league team', async () => {
    await db().doc('leagueTeams/crazy-guns').set({ name: 'Crazy Guns', captainUid: null, seasons: [YEAR - 1] });
    await db().doc(`seasons/${YEAR}/teams/crazy-guns`).set({
      name: 'Crazy Guns', captain: '', totals: { targets: [1], rankPoints: [], bonusPoints: [] },
      shooters: [{ id: 'x', name: 'Al One', rookie: false, startingAvg: 44, finalAvg: null, weeksShot: null, scores: [] },
        { id: '', name: 'Gone Guy', rookie: false, startingAvg: 30, finalAvg: null, weeksShot: null, scores: [] }],
    });
    await seedProposal({ teamSource: 'returning', leagueTeamId: 'crazy-guns', teamName: 'Crazy Guns' });
    await approve();
    const team = await data(`seasons/${YEAR}/teams/crazy-guns`);
    const shooters = team?.['shooters'] as { id: string; name: string; startingAvg: number }[];
    expect(shooters.map((s) => s.name)).toEqual(FIVE);
    expect(shooters[1]).toMatchObject({ id: 'x', startingAvg: 44 });
    expect(team?.['totals']).toEqual({ targets: [1], rankPoints: [], bonusPoints: [] });
    expect(await data('leagueTeams/crazy-guns')).toMatchObject({ captainUid: CAPTAIN, seasons: [YEAR - 1, YEAR] });
  });

  it('refuses to drop a shooter with scores, and writes nothing', async () => {
    await db().doc(`seasons/${YEAR}/teams/clay-busters`).set({
      name: 'Clay Busters', captain: '', totals: {},
      shooters: [{ id: '', name: 'Ed Five', rookie: false, startingAvg: 40, finalAvg: null, weeksShot: null, scores: [] }],
    });
    await db().doc(`seasons/${YEAR}/entries/3_clay-busters`).set({ weekNumber: 3, teamName: 'Clay Busters', shooters: [{ name: 'ed five', total: 40 }] });
    await seedProposal();
    await expect(approve()).rejects.toMatchObject({ code: 'failed-precondition', details: { reason: 'shooter-has-scores' } });
    expect((await data(`teamProposals/${PID}`))?.['status']).toBe('submitted');
    expect(await data('leagueTeams/clay-busters')).toBeUndefined();
  });

  it('refuses a missing average', async () => {
    await seedProposal();
    await expect(approve({ settings: settings(FIVE.slice(1)) }))
      .rejects.toMatchObject({ code: 'invalid-argument', details: { reason: 'missing-average' } });
  });

  it('refuses when the team got a captain, the name was taken, or the captain leads another team', async () => {
    await db().doc('leagueTeams/crazy-guns').set({ name: 'Crazy Guns', captainUid: OTHER, seasons: [] });
    await seedProposal({ teamSource: 'returning', leagueTeamId: 'crazy-guns', teamName: 'Crazy Guns' });
    await expect(approve()).rejects.toMatchObject({ details: { reason: 'team-has-captain' } });

    await seedProposal();
    await db().doc('leagueTeams/clay-busters').set({ name: 'Clay Busters', captainUid: null, seasons: [] });
    await expect(approve()).rejects.toMatchObject({ details: { reason: 'league-team-exists' } });

    await db().doc('leagueTeams/clay-busters').delete();
    await db().doc('leagueTeams/crazy-guns').update({ captainUid: CAPTAIN });
    await expect(approve()).rejects.toMatchObject({ details: { reason: 'already-captain' } });
  });

  it('refuses a deactivated captain', async () => {
    await seedProposal();
    await db().doc(`users/${CAPTAIN}`).update({ status: 'deactivated' });
    await expect(approve()).rejects.toMatchObject({ details: { reason: 'not-eligible' } });
  });
});

describe('reject and request changes', () => {
  it('request-changes needs a note; reject does not', async () => {
    await seedProposal();
    await expect(asAdmin({ type: 'proposal', id: PID, action: 'request-changes' }))
      .rejects.toMatchObject({ details: { reason: 'note-required' } });
    await expect(asAdmin({ type: 'proposal', id: PID, action: 'request-changes', note: 'Add a fifth shooter' }))
      .resolves.toEqual({ ok: true, status: 'changes-requested' });
    expect(await data(`teamProposals/${PID}`)).toMatchObject({ status: 'changes-requested', reviewNote: 'Add a fifth shooter' });

    await seedProposal();
    await expect(asAdmin({ type: 'proposal', id: PID, action: 'reject' })).resolves.toEqual({ ok: true, status: 'rejected' });
    expect(await auditOf('proposal')).toEqual(expect.arrayContaining(['changes-requested', 'rejected']));
  });
});

describe('change requests', () => {
  const callProposal = (payload: unknown) => proposalFn(callableRequest({ uid: CAPTAIN, role: 'user', data: payload }));

  beforeEach(async () => {
    await seedProposal();
    await approve();
  });

  it('reopen rebuilds the draft from the published team; approve applies the change', async () => {
    await expect(callProposal({ action: 'reopen', year: YEAR })).resolves.toEqual({ ok: true, status: 'draft' });
    const reopened = await data(`teamProposals/${PID}`);
    expect(reopened).toMatchObject({ purpose: 'change', status: 'draft' });
    expect((reopened?.['shooters'] as { kind: string }[])[0]?.kind).toBe('self');

    const shooters = [
      { kind: 'self', rookie: false },
      ...['Al One', 'Bo Two', 'Cy Three', 'Ed Five'].map((n) => {
        const [firstName, lastName] = n.split(' ');
        return { kind: 'named', firstName, lastName, rookie: false, minor: false };
      }),
    ];
    // The team fields are ignored for a change.
    await callProposal({ action: 'save', year: YEAR, teamSource: 'new', leagueTeamId: null, teamName: 'Renamed', shooters });
    expect((await data(`teamProposals/${PID}`))?.['teamName']).toBe('Clay Busters');
    await callProposal({ action: 'submit', year: YEAR });
    await asAdmin({ type: 'proposal', id: PID, action: 'approve', settings: settings(['Ed Five']) });
    const names = ((await data(`seasons/${YEAR}/teams/clay-busters`))?.['shooters'] as { name: string }[]).map((s) => s.name);
    expect(names).toEqual([`Pat ${CAPTAIN}`, 'Al One', 'Bo Two', 'Cy Three', 'Ed Five']);
  });

  it('rejecting a change and discarding a draft both restore the published roster', async () => {
    await callProposal({ action: 'reopen', year: YEAR });
    await db().doc(`teamProposals/${PID}`).update({ status: 'submitted', shooters: roster([`Pat ${CAPTAIN}`, 'X Y']) });
    await expect(asAdmin({ type: 'proposal', id: PID, action: 'reject', note: 'Not now' }))
      .resolves.toEqual({ ok: true, status: 'approved' });
    let p = await data(`teamProposals/${PID}`);
    expect((p?.['shooters'] as { name: string }[]).map((s) => s.name)).toEqual(FIVE);

    await callProposal({ action: 'reopen', year: YEAR });
    await db().doc(`teamProposals/${PID}`).update({ shooters: roster([`Pat ${CAPTAIN}`]) });
    await expect(callProposal({ action: 'delete', year: YEAR })).resolves.toEqual({ ok: true, status: 'approved' });
    p = await data(`teamProposals/${PID}`);
    expect((p?.['shooters'] as unknown[]).length).toBe(5);
  });

  it('reopen is refused for someone no longer the captain', async () => {
    await db().doc('leagueTeams/clay-busters').update({ captainUid: OTHER });
    await expect(callProposal({ action: 'reopen', year: YEAR })).rejects.toMatchObject({ details: { reason: 'not-captain' } });
  });
});

describe('registrations', () => {
  const RID = `${YEAR}_${OTHER}`;

  beforeEach(async () => {
    await db().doc(`profiles/${OTHER}/dependents/d1`).set({ firstName: 'Sam', lastName: 'doe', birthYear: YEAR - 12 });
    await db().doc(`seasons/${YEAR}/teams/crazy-guns`).set({
      name: 'Crazy Guns', captain: 'Al One', totals: {},
      shooters: [{ id: '', name: 'Al One', rookie: false, startingAvg: 40, finalAvg: null, weeksShot: null, scores: [] }],
    });
    await db().doc(`registrations/${RID}`).set({
      uid: OTHER, year: YEAR, dependentIds: ['d1'], preferredLeagueTeamId: null, note: null, status: 'submitted',
    });
  });

  const place = (extra: Record<string, unknown> = {}) => asAdmin({
    type: 'registration', id: RID, action: 'place', teamId: 'crazy-guns',
    settings: settings([`Pat ${OTHER}`, 'Sam D.']), ...extra,
  });

  it('places the member and their dependent on the team and records the league season', async () => {
    await expect(place()).resolves.toEqual({ ok: true, status: 'placed' });
    const names = ((await data(`seasons/${YEAR}/teams/crazy-guns`))?.['shooters'] as { name: string }[]).map((s) => s.name);
    expect(names).toEqual(['Al One', `Pat ${OTHER}`, 'Sam D.']);
    expect(await data(`registrations/${RID}`)).toMatchObject({ status: 'placed', placedLeagueTeamId: 'crazy-guns' });
    expect(await data('leagueTeams/crazy-guns')).toMatchObject({ captainUid: null, seasons: [YEAR] });
    expect(await auditOf('registration')).toEqual(['placed']);
  });

  it('refuses a missing team, a removed dependent, and a name already on the team', async () => {
    await expect(place({ teamId: 'ghosts' })).rejects.toMatchObject({ details: { reason: 'no-team' } });
    await expect(place({ teamId: null })).rejects.toMatchObject({ details: { reason: 'team-required' } });
    await db().doc(`profiles/${OTHER}/dependents/d1`).delete();
    await expect(place()).rejects.toMatchObject({ details: { reason: 'unknown-dependent' } });
    await db().doc(`registrations/${RID}`).update({ dependentIds: [] });
    await db().doc(`profiles/${OTHER}`).update({ displayName: 'Al One' });
    await expect(place({ settings: settings(['Al One']) })).rejects.toMatchObject({ details: { reason: 'duplicate-name' } });
  });

  it('declines with a note', async () => {
    await expect(asAdmin({ type: 'registration', id: RID, action: 'decline', note: 'Teams are full' }))
      .resolves.toEqual({ ok: true, status: 'declined' });
    expect(await data(`registrations/${RID}`)).toMatchObject({ status: 'declined', reviewNote: 'Teams are full' });
  });
});

describe('shooter links', () => {
  beforeEach(async () => {
    await db().doc(`shooterLinkRequests/${OTHER}`).set({ shooterName: 'pat  shooter', status: 'submitted' });
  });

  it('links a corrected name and records the request', async () => {
    await expect(asAdmin({ type: 'link', uid: OTHER, action: 'approve', shooterName: 'Pat Shooter' }))
      .resolves.toEqual({ ok: true, status: 'approved' });
    expect(await data(`shooterLinks/${OTHER}`)).toMatchObject({ shooterName: 'Pat Shooter', nameKey: 'pat shooter', linkedBy: ADMIN });
    expect((await data(`shooterLinkRequests/${OTHER}`))?.['status']).toBe('approved');
  });

  it('refuses a name linked to another account; declines', async () => {
    await db().doc(`shooterLinks/${CAPTAIN}`).set({ shooterName: 'Pat Shooter', nameKey: 'pat shooter' });
    await expect(asAdmin({ type: 'link', uid: OTHER, action: 'approve', shooterName: 'PAT SHOOTER' }))
      .rejects.toMatchObject({ details: { reason: 'name-taken' } });
    await expect(asAdmin({ type: 'link', uid: OTHER, action: 'decline', note: 'Not found' }))
      .resolves.toEqual({ ok: true, status: 'declined' });
    expect(await auditOf('shooter-link')).toEqual(['declined']);
  });
});

describe('captain decisions', () => {
  beforeEach(async () => {
    await db().doc('leagueTeams/crazy-guns').set({ name: 'Crazy Guns', captainUid: CAPTAIN, seasons: [YEAR] });
    await db().doc('captainChanges/crazy-guns').set({ leagueTeamId: 'crazy-guns', fromUid: CAPTAIN, toUid: OTHER, status: 'accepted' });
  });

  const decide = (action: string) => asAdmin({ type: 'captain', leagueTeamId: 'crazy-guns', action });

  it('approves an accepted handoff', async () => {
    await expect(decide('approve')).resolves.toEqual({ ok: true, status: 'approved' });
    expect((await data('leagueTeams/crazy-guns'))?.['captainUid']).toBe(OTHER);
    expect((await data('captainChanges/crazy-guns'))?.['status']).toBe('approved');
    await expect(decide('approve')).rejects.toMatchObject({ details: { reason: 'bad-status' } });
  });

  it('refuses a stale handoff or an ineligible nominee; declines', async () => {
    await db().doc(`users/${OTHER}`).update({ status: 'deactivated' });
    await expect(decide('approve')).rejects.toMatchObject({ details: { reason: 'not-eligible' } });
    await db().doc('leagueTeams/crazy-guns').update({ captainUid: ADMIN });
    await expect(decide('approve')).rejects.toMatchObject({ details: { reason: 'stale-handoff' } });
    await expect(decide('decline')).resolves.toEqual({ ok: true, status: 'rejected' });
  });

  it('removes a captain and cancels the open handoff', async () => {
    await expect(decide('clear')).resolves.toEqual({ ok: true, status: 'cleared' });
    expect((await data('leagueTeams/crazy-guns'))?.['captainUid']).toBeNull();
    expect((await data('captainChanges/crazy-guns'))?.['status']).toBe('cancelled');
    await expect(decide('clear')).rejects.toMatchObject({ details: { reason: 'no-captain' } });
    expect(await auditOf('captain')).toEqual(['cleared']);
  });
});
