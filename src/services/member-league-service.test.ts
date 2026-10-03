import { describe, expect, it, vi } from 'vitest';

vi.mock('@/firebase-config', () => ({ db: {} }));
vi.mock('@/infrastructure/functions', () => ({ callable: vi.fn() }));
import { MemberLeagueService, leagueErrorMessage, resultMessage } from './member-league-service';
import type { LeagueRepository } from '@/repositories/league-repository';
import type { DependentRepository } from '@/repositories/dependent-repository';

function makeService(overrides: { league?: Partial<LeagueRepository>; deps?: Partial<DependentRepository>; call?: ReturnType<typeof vi.fn> } = {}) {
  const call = overrides.call ?? vi.fn().mockResolvedValue({ data: { ok: true, status: 'draft' } });
  const svc = new MemberLeagueService(
    (overrides.league ?? {}) as LeagueRepository,
    (overrides.deps ?? {}) as DependentRepository,
    () => call as never,
  );
  return { svc, call };
}

describe('leagueErrorMessage and resultMessage', () => {
  it('shows the server message when a reason is present', () => {
    expect(leagueErrorMessage('functions/permission-denied', 'team-has-captain', 'This team already has a captain.'))
      .toBe('This team already has a captain.');
  });

  it('falls back to the account map without a reason', () => {
    expect(leagueErrorMessage('functions/resource-exhausted')).toMatch(/Too many/);
  });

  it('resultMessage shows validation text, else maps the code', () => {
    expect(resultMessage({ error: 'Enter a team name.', code: 'VALIDATION' })).toBe('Enter a team name.');
    expect(resultMessage({ error: 'x', code: 'permission-denied' })).toMatch(/permission/);
  });
});

describe('MemberLeagueService', () => {
  it('saveProposal validates the team name before calling, and drops leagueTeamId for new teams', async () => {
    const { svc, call } = makeService();
    const bad = await svc.saveProposal(2026, { teamSource: 'new', leagueTeamId: null, teamName: 'x', shooters: [] });
    expect(bad).toMatchObject({ ok: false, reason: 'team-name' });
    expect(call).not.toHaveBeenCalled();

    await svc.saveProposal(2026, { teamSource: 'new', leagueTeamId: 'eagles', teamName: ' Clay  Busters ', shooters: [] });
    expect(call).toHaveBeenCalledWith({
      action: 'save', year: 2026, teamSource: 'new', leagueTeamId: null, teamName: 'Clay Busters', shooters: [],
    });
  });

  it('surfaces callable error code, reason and message', async () => {
    const call = vi.fn().mockRejectedValue({ code: 'functions/failed-precondition', message: 'Withdraw first.', details: { reason: 'bad-status' } });
    const { svc } = makeService({ call });
    expect(await svc.proposalAction(2026, 'submit')).toEqual({
      ok: false, code: 'functions/failed-precondition', reason: 'bad-status', message: 'Withdraw first.',
    });
  });

  it('addDependent enforces the cap and validation before writing', async () => {
    const create = vi.fn().mockResolvedValue('d1');
    const { svc } = makeService({ deps: { create } });
    expect((await svc.addDependent('u', { firstName: 'Sam', lastName: 'Doe', birthYear: 2015 }, 6)).success).toBe(false);
    expect((await svc.addDependent('u', { firstName: '', lastName: 'Doe', birthYear: 2015 }, 0)).success).toBe(false);
    expect(create).not.toHaveBeenCalled();
    const ok = await svc.addDependent('u', { firstName: 'Sam', lastName: 'Doe', birthYear: new Date().getUTCFullYear() - 10 }, 0);
    expect(ok).toEqual({ success: true, data: 'd1' });
  });

  it('loadOverview reads the linked name only for an approved request', async () => {
    const findLinkedName = vi.fn().mockResolvedValue('Pat Q. Shooter');
    const league = {
      findProposal: vi.fn().mockResolvedValue(null),
      findRegistration: vi.fn().mockResolvedValue(null),
      findLinkRequest: vi.fn().mockResolvedValue({ shooterName: 'Pat', status: 'submitted' }),
      findLinkedName,
    };
    const { svc } = makeService({ league, deps: { list: vi.fn().mockResolvedValue([]) } });
    const pending = await svc.loadOverview('u', 2026);
    expect(pending.success && pending.data.linkedName).toBeNull();
    expect(findLinkedName).not.toHaveBeenCalled();

    league.findLinkRequest.mockResolvedValue({ shooterName: 'Pat', status: 'approved' });
    const approved = await svc.loadOverview('u', 2026);
    expect(approved.success && approved.data.linkedName).toBe('Pat Q. Shooter');
  });

  it('saveRegistration normalizes an empty note to null', async () => {
    const createRegistration = vi.fn().mockResolvedValue(undefined);
    const { svc } = makeService({ league: { createRegistration } });
    await svc.saveRegistration('u', 2026, { dependentIds: [], preferredLeagueTeamId: null, note: '  ' }, false);
    expect(createRegistration).toHaveBeenCalledWith(2026, 'u', { dependentIds: [], preferredLeagueTeamId: null, note: null });
  });
});
