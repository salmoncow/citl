/**
 * @file season-awards-service.test.ts
 * Unit tests for SeasonAwardsService (spec 004 DD-3).
 *
 * ScoreRepository is stubbed with in-memory data; a REAL ScoreService runs on
 * top of it so previewAwards exercises the genuine buildScorecardData
 * derivation (prior-year rookie/W0 rules included). Never imports
 * app-services.
 *
 * Pinned invariant: the awards path reads PUBLISHED data only — the stub
 * asserts getEntries is never called (entries are draft audit docs and may
 * not exist for complete seasons).
 */

import { describe, it, expect, vi } from 'vitest';
import { SeasonAwardsService } from './season-awards-service';
import { ScoreService } from './score-service';
import { success, failure } from '@/repositories/score-repository';
import type { ScoreRepository } from '@/repositories/score-repository';
import type { Team, WeekResult } from '@/types/score';
import type { Season, SeasonStandings } from '@/types/season';
import type { Shooter } from '@/types/shooter';

// ---------------------------------------------------------------------------
// Fixtures — one team, two shooters, six published weeks
// ---------------------------------------------------------------------------

const YEAR = 2025;

function makeShooter(name: string, startingAvg: number, finalAvg: number | null = null): Shooter {
  return {
    id: '',
    name,
    rookie: false,
    startingAvg,
    finalAvg,
    weeksShot: null,
    scores: new Array<number | null>(15).fill(null),
  };
}

function makeTeam(name: string, shooters: Shooter[]): Team {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    captain: '',
    shooters,
    totals: { targets: [], rankPoints: [], bonusPoints: [] },
  };
}

/** Six published weeks: Vet shoots 45 every week, Rook shoots 40. */
function makeWeeks(teamName: string): WeekResult[] {
  return Array.from({ length: 6 }, (_, i) => ({
    weekNumber: i + 1,
    publishedAt: '',
    teamResults: [
      {
        teamId: 'team-a',
        teamName,
        targets: 85,
        rankPoints: 30,
        bonusPoints: 0,
        shooterScores: [
          { name: 'Vet', score1: null, score2: null, total: 45 },
          { name: 'Rook', score1: null, score2: null, total: 40 },
        ],
      },
    ],
  }));
}

const STANDINGS: SeasonStandings[] = [
  { rank: 1, teamId: 'team-a', teamName: 'Team A', totalRankPoints: 400, totalBonusPoints: 33, totalTargets: 5000 },
  { rank: 2, teamId: 'team-b', teamName: 'Team B', totalRankPoints: 390, totalBonusPoints: 25, totalTargets: 4900 },
];

function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: String(YEAR),
    year: YEAR,
    status: 'active',
    currentWeek: 15,
    standings: STANDINGS,
    awards: null,
    ...overrides,
  };
}

/**
 * Stub repository. `Vet` has a prior-year finalAvg of 40 (non-rookie,
 * startingAvg 40); `Rook` has no prior history (rookie, default 35).
 */
function makeRepo(opts: {
  season?: Season | null;
  seasonFailure?: boolean;
  teamsFail?: boolean;
  weeksFail?: boolean;
  updateSeasonFail?: boolean;
} = {}): ScoreRepository & { updateSeason: ReturnType<typeof vi.fn>; getEntries: ReturnType<typeof vi.fn> } {
  const teamA = makeTeam('Team A', [makeShooter('Vet', 40), makeShooter('Rook', 35)]);
  const priorTeam = makeTeam('Old Team', [makeShooter('Vet', 38, 40)]);
  const stub = {
    getSeason: async () =>
      opts.seasonFailure
        ? failure('boom', 'FIRESTORE_READ_ERROR')
        : success(opts.season === undefined ? makeSeason() : opts.season),
    getTeams: async (y: number) => {
      if (opts.teamsFail && y === YEAR) return failure('teams boom', 'FIRESTORE_READ_ERROR');
      if (y === YEAR) return success([teamA]);
      if (y === YEAR - 1) return success([priorTeam]);
      return success([]);
    },
    getAllWeekResults: async (y: number) => {
      if (opts.weeksFail && y === YEAR) return failure('weeks boom', 'FIRESTORE_READ_ERROR');
      if (y === YEAR) return success(makeWeeks('Team A'));
      return success([]);
    },
    updateSeason: vi.fn(async () =>
      opts.updateSeasonFail
        ? failure('write boom', 'FIRESTORE_WRITE_ERROR')
        : success({}),
    ),
    getEntries: vi.fn(async () => success([])),
  };
  return stub as unknown as ScoreRepository & {
    updateSeason: ReturnType<typeof vi.fn>;
    getEntries: ReturnType<typeof vi.fn>;
  };
}

function makeServices(opts: Parameters<typeof makeRepo>[0] = {}) {
  const repo = makeRepo(opts);
  const scoreService = new ScoreService(repo);
  const service = new SeasonAwardsService(repo, scoreService);
  return { repo, scoreService, service };
}

// ---------------------------------------------------------------------------
// previewAwards
// ---------------------------------------------------------------------------

describe('SeasonAwardsService.previewAwards', () => {
  it('happy path: full flat awards from published weeks + stored standings', async () => {
    const { service } = makeServices();
    const result = await service.previewAwards(YEAR);
    expect(result.success).toBe(true);
    if (!result.success) return;

    // Placements from the stored standings rows (points = rank + bonus).
    expect(result.data.firstPlaceTeam).toBe('Team A');
    expect(result.data.firstPlacePoints).toBe(433);
    expect(result.data.secondPlaceTeam).toBe('Team B');
    expect(result.data.secondPlacePoints).toBe(415);

    // Vet: prior finalAvg 40 → startingAvg 40, non-rookie; 6×45 → finalAvg 45.
    expect(result.data.highestAvgShooter).toBe('Vet');
    expect(result.data.highestAvg).toBe(45);

    // Rook: no prior history → rookie, startingAvg 35; 6×40 → finalAvg 40.
    expect(result.data.rookieOfYear).toBe('Rook');
    expect(result.data.rookieAvg).toBe(40);

    // Most improved: Vet 100·(45−40)/(50−40)=50% beats Rook 100·5/15≈33.33%.
    expect(result.data.mostImproved).toBe('Vet');
    expect(result.data.improvement).toBe('50.00%');
  });

  it('consistency property: winners agree with the scorecard rows the public sees', async () => {
    const { service, scoreService } = makeServices();
    const [awards, scorecards] = await Promise.all([
      service.previewAwards(YEAR),
      scoreService.buildScorecardData(YEAR),
    ]);
    expect(awards.success && scorecards.success).toBe(true);
    if (!awards.success || !scorecards.success) return;

    const rows = scorecards.data.teams.flatMap((b) => b.shooters).filter((r) => !r.isDummy);
    const topRow = rows.reduce((best, r) =>
      Number(r.finalAvg) > Number(best.finalAvg) ? r : best,
    );
    expect(awards.data.highestAvgShooter).toBe(topRow.name);
  });

  it('NO_DATA when the season document is missing', async () => {
    const { service } = makeServices({ season: null });
    const result = await service.previewAwards(YEAR);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('NO_DATA');
  });

  it('NO_DATA when the season has zero published weeks (currentWeek 0)', async () => {
    const { service } = makeServices({ season: makeSeason({ currentWeek: 0 }) });
    const result = await service.previewAwards(YEAR);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('NO_DATA');
  });

  it('propagates a getSeason failure unchanged', async () => {
    const { service } = makeServices({ seasonFailure: true });
    const result = await service.previewAwards(YEAR);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('FIRESTORE_READ_ERROR');
  });

  it('propagates a buildScorecardData failure (teams + weeks both failing)', async () => {
    const { service } = makeServices({ teamsFail: true, weeksFail: true });
    const result = await service.previewAwards(YEAR);
    expect(result.success).toBe(false);
  });

  it('never reads draft entries — published data only', async () => {
    const { service, repo } = makeServices();
    await service.previewAwards(YEAR);
    expect(repo.getEntries).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// finalizeSeason
// ---------------------------------------------------------------------------

describe('SeasonAwardsService.finalizeSeason', () => {
  it("writes { awards, status: 'complete' } via updateSeason and clears the cache", async () => {
    const { service, repo, scoreService } = makeServices();
    const clearSpy = vi.spyOn(scoreService, 'clearCache');

    const result = await service.finalizeSeason(YEAR);
    expect(result.success).toBe(true);

    expect(repo.updateSeason).toHaveBeenCalledTimes(1);
    const [year, updates] = repo.updateSeason.mock.calls[0] as [number, Partial<Season>];
    expect(year).toBe(YEAR);
    expect(updates.status).toBe('complete');
    expect(updates.awards?.highestAvgShooter).toBe('Vet');
    expect(updates.awards?.firstPlaceTeam).toBe('Team A');
    expect(clearSpy).toHaveBeenCalled();
  });

  it('propagates a preview failure without writing', async () => {
    const { service, repo } = makeServices({ season: null });
    const result = await service.finalizeSeason(YEAR);
    expect(result.success).toBe(false);
    expect(repo.updateSeason).not.toHaveBeenCalled();
  });

  it('propagates an updateSeason failure and does NOT clear the cache after a failed write', async () => {
    const { service, scoreService } = makeServices({ updateSeasonFail: true });
    const clearSpy = vi.spyOn(scoreService, 'clearCache');
    const result = await service.finalizeSeason(YEAR);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('FIRESTORE_WRITE_ERROR');
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('is idempotent: a second finalize recomputes and rewrites without error', async () => {
    const { service, repo } = makeServices();
    const first = await service.finalizeSeason(YEAR);
    const second = await service.finalizeSeason(YEAR);
    expect(first.success && second.success).toBe(true);
    expect(repo.updateSeason).toHaveBeenCalledTimes(2);
    if (!first.success || !second.success) return;
    expect(second.data).toEqual(first.data);
  });
});
