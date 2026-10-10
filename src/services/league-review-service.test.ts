import { describe, expect, it, vi } from 'vitest';

vi.mock('@/firebase-config', () => ({ db: {} }));
vi.mock('@/infrastructure/functions', () => ({ callable: vi.fn() }));
import { LeagueReviewService, compareRoster, proposalTeamId } from './league-review-service';
import type { LeagueReviewRepository } from '@/repositories/league-review-repository';
import type { Shooter } from '@/types/shooter';

const shooter = (name: string, startingAvg = 40): Shooter =>
  ({ id: '', name, rookie: false, startingAvg, finalAvg: null, weeksShot: null, scores: [] });
const ts = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) });

describe('compareRoster', () => {
  it('marks returning, new, and dropped shooters and attaches this season’s record', () => {
    const rows = compareRoster(
      ['Pat Captain', 'al one', 'New Guy'],
      [shooter('Al One'), shooter('Gone Guy')],
      [shooter('New Guy', 33)],
    );
    expect(rows.map((r) => [r.name, r.status, r.stored?.startingAvg ?? null])).toEqual([
      ['Pat Captain', 'new', null],
      ['al one', 'returning', null],
      ['New Guy', 'new', 33],
      ['Gone Guy', 'dropped', null],
    ]);
  });

  it('lists shooters on this season’s team but not in the proposal as dropped', () => {
    const rows = compareRoster(['Pat Captain'], [shooter('Gone Guy')], [shooter('Placed Member', 31), shooter('gone guy', 38)]);
    expect(rows.map((r) => [r.name, r.status, r.stored?.startingAvg ?? null])).toEqual([
      ['Pat Captain', 'new', null],
      ['Gone Guy', 'dropped', 38],
      ['Placed Member', 'dropped', 31],
    ]);
  });

  it('treats everyone as new when there is no last season', () => {
    expect(compareRoster(['A B'], null, null)).toEqual([{ name: 'A B', status: 'new', stored: null }]);
  });
});

describe('proposalTeamId', () => {
  it('uses the league team, else the name slug', () => {
    expect(proposalTeamId({ leagueTeamId: 'crazy-guns', teamName: 'Whatever' })).toBe('crazy-guns');
    expect(proposalTeamId({ leagueTeamId: null, teamName: ' Clay  Busters ' })).toBe('clay-busters');
  });
});

describe('LeagueReviewService.loadQueue', () => {
  function repo(): LeagueReviewRepository {
    return {
      listSubmittedProposals: vi.fn().mockResolvedValue([
        { id: 'p2', captainUid: 'u2', teamName: 'Crazy Guns', leagueTeamId: 'crazy-guns', submittedAt: ts(2), shooters: [] },
        { id: 'p1', captainUid: 'u1', teamName: 'Crazy Guns', leagueTeamId: 'crazy-guns', submittedAt: ts(1), shooters: [] },
      ]),
      listSubmittedRegistrations: vi.fn().mockResolvedValue([{ id: 'r1', uid: 'u3', dependentIds: ['d1'], createdAt: ts(5) }]),
      listSubmittedLinks: vi.fn().mockResolvedValue([{ id: 'u4', shooterName: 'Pat', status: 'submitted' }]),
      listAcceptedHandoffs: vi.fn().mockResolvedValue([]),
      listCaptainedTeams: vi.fn().mockResolvedValue([{ id: 't', name: 'T', captainUid: 'u1', seasons: [] }]),
      memberInfo: vi.fn().mockImplementation(async (uid: string) => ({ name: `Name ${uid}`, email: null, active: true })),
      dependents: vi.fn().mockResolvedValue([{ id: 'd1', firstName: 'Sam', lastName: 'doe', birthYear: 2015 }]),
      linkedName: vi.fn().mockResolvedValue('Linked Name'),
    } as unknown as LeagueReviewRepository;
  }

  it('orders oldest first, flags competing proposals, reads each member once, and names placements', async () => {
    const r = repo();
    const svc = new LeagueReviewService(r, () => vi.fn() as never);
    const res = await svc.loadQueue();
    if (!res.success) throw new Error(res.error);
    expect(res.data.proposals.map((p) => [p.proposal.id, p.competing, p.member.name])).toEqual([
      ['p1', 1, 'Name u1'],
      ['p2', 1, 'Name u2'],
    ]);
    expect(r.memberInfo).toHaveBeenCalledTimes(4);
    expect(res.data.links[0]).toMatchObject({ uid: 'u4', member: { name: 'Name u4' } });
    expect(svc.placementNames(res.data.registrations[0]!)).toEqual(['Linked Name', 'Sam D.']);
    expect(res.data.captains[0]?.captain.name).toBe('Name u1');
  });

  it('marks a join request whose member has a link request waiting (spec 012 AC-9)', async () => {
    const r = repo();
    (r.listSubmittedRegistrations as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'r1', uid: 'u3', dependentIds: [], createdAt: ts(5) },
      { id: 'r2', uid: 'u4', dependentIds: [], createdAt: ts(6) },
    ]);
    const res = await new LeagueReviewService(r, () => vi.fn() as never).loadQueue();
    if (!res.success) throw new Error(res.error);
    expect(res.data.registrations.map((x) => [x.registration.id, x.pendingLinkName])).toEqual([
      ['r1', null],
      ['r2', 'Pat'],
    ]);
  });

  it('returns a failure when a read fails', async () => {
    const r = repo();
    (r.listSubmittedLinks as ReturnType<typeof vi.fn>).mockRejectedValue(Object.assign(new Error('x'), { code: 'permission-denied' }));
    const res = await new LeagueReviewService(r, () => vi.fn() as never).loadQueue();
    expect(res).toMatchObject({ success: false, code: 'permission-denied' });
  });
});

describe('LeagueReviewService.review', () => {
  it('maps callable errors to an outcome with the reason', async () => {
    const call = vi.fn().mockRejectedValue({ code: 'functions/failed-precondition', message: 'Has scores', details: { reason: 'shooter-has-scores' } });
    const svc = new LeagueReviewService({} as LeagueReviewRepository, () => call as never);
    await expect(svc.review({ type: 'proposal', id: 'p', action: 'approve' }))
      .resolves.toEqual({ ok: false, code: 'functions/failed-precondition', reason: 'shooter-has-scores', message: 'Has scores' });
    call.mockResolvedValue({ data: { ok: true, status: 'approved' } });
    await expect(svc.review({ type: 'proposal', id: 'p', action: 'approve' })).resolves.toEqual({ ok: true, status: 'approved' });
  });
});

describe('LeagueReviewService.countWaiting', () => {
  it('returns the repository count, and a failure when the read throws', async () => {
    const ok = { countWaiting: vi.fn().mockResolvedValue(7) } as unknown as LeagueReviewRepository;
    expect(await new LeagueReviewService(ok, () => vi.fn() as never).countWaiting()).toEqual({ success: true, data: 7 });

    vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = { countWaiting: vi.fn().mockRejectedValue(new Error('denied')) } as unknown as LeagueReviewRepository;
    const res = await new LeagueReviewService(bad, () => vi.fn() as never).countWaiting();
    expect(res.success).toBe(false);
  });
});
