/**
 * @file score-service.test.ts
 * Unit tests for ScoreService methods that depend on prior-year data lookups.
 *
 * ScoreRepository is stubbed with in-memory data — no Firestore needed.
 * Focus areas:
 *   - computeShooterDefaults: starting-avg and rookie lookup for a single name
 *   - computeRosterDefaults: same logic applied to an entire team roster
 *
 * Key regression: _buildAvgMapFromWeekResults must blend startingAvg into the
 * mean when a shooter has fewer than 2 weeks of published results (mirrors
 * computeShooterAverage). Before the fix, a shooter who shot once with a
 * score of 38 and a prior going-in avg of 43 would receive startingAvg=38
 * instead of the correct 40.5.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { ScoreService } from './score-service';
import { buildPriorAvgMap, computeShooterAverage } from './scoring-engine';
import { success, failure } from '@/types/result';
import type { ScoreRepository } from '@/repositories/score-repository';
import type { Team, WeekResult, SeasonEntry } from '@/types/score';
import type { Shooter } from '@/types/shooter';
import type { Season, SeasonStandings } from '@/types/season';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeShooter(
  name: string,
  startingAvg: number,
  finalAvg: number | null = null,
): Shooter {
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

function makeWeekResult(
  shooterScores: { name: string; total: number }[],
): WeekResult {
  return {
    weekNumber: 1,
    publishedAt: '',
    teamResults: [
      {
        teamId: 't1',
        teamName: 'Team',
        targets: 0,
        rankPoints: 0,
        bonusPoints: 0,
        shooterScores: shooterScores.map((s) => ({
          name: s.name,
          score1: null,
          score2: null,
          total: s.total,
        })),
      },
    ],
  };
}

/**
 * Minimal repository stub. getTeams dispatches by year relative to `currentYear`
 * so both prior-1 and prior-2 calls resolve correctly.
 */
function makeRepo(opts: {
  currentYear?: number;
  currentTeam?: Team | null;
  prior1Teams?: Team[];
  prior2Teams?: Team[];
  prior1Weeks?: WeekResult[];
  prior2Weeks?: WeekResult[];
}): ScoreRepository {
  const year = opts.currentYear ?? 2026;
  const stub: Partial<ScoreRepository> = {
    getTeam: async () => success(opts.currentTeam ?? null),
    getTeams: async (y) => {
      if (y === year - 1) return success(opts.prior1Teams ?? []);
      if (y === year - 2) return success(opts.prior2Teams ?? []);
      return success([]);
    },
    getAllWeekResults: async (y) => {
      if (y === year - 1) return success(opts.prior1Weeks ?? []);
      if (y === year - 2) return success(opts.prior2Weeks ?? []);
      return success([]);
    },
  };
  return stub as unknown as ScoreRepository;
}

// ---------------------------------------------------------------------------
// buildPriorAvgMap — shared helper used by score-service AND season-scorecards
// ---------------------------------------------------------------------------

describe('buildPriorAvgMap', () => {
  it('returns an empty map when no week results are provided', () => {
    expect(buildPriorAvgMap([], [])).toEqual(new Map());
  });

  it('regression: 1 week shot — blends startingAvg into mean (not a raw score average)', () => {
    // Shooter with startingAvg=43 scored 38 once.
    // Correct: mean([43, 38]) = 40.5.  Bug: 38 / 1 = 38.
    const priorTeams = [makeTeam('Team', [makeShooter('Alice', 43)])];
    const weeks = [makeWeekResult([{ name: 'Alice', total: 38 }])];
    const map = buildPriorAvgMap(weeks, priorTeams);
    expect(map.get('alice')).toBe(40.5);
  });

  it('2 weeks shot — startingAvg is phased out, uses raw mean', () => {
    // total = 40 + 42 = 82, weeks = 2 → 82/2 = 41. startingAvg must NOT be included.
    const priorTeams = [makeTeam('Team', [makeShooter('Bob', 35)])];
    const weeks = [
      makeWeekResult([{ name: 'Bob', total: 40 }]),
      { ...makeWeekResult([{ name: 'Bob', total: 42 }]), weekNumber: 2 },
    ];
    const map = buildPriorAvgMap(weeks, priorTeams);
    expect(map.get('bob')).toBe(41);
  });

  it('3+ weeks shot — raw mean only', () => {
    const priorTeams = [makeTeam('Team', [makeShooter('Carol', 35)])];
    const weeks = [
      makeWeekResult([{ name: 'Carol', total: 40 }]),
      { ...makeWeekResult([{ name: 'Carol', total: 42 }]), weekNumber: 2 },
      { ...makeWeekResult([{ name: 'Carol', total: 44 }]), weekNumber: 3 },
    ];
    const map = buildPriorAvgMap(weeks, priorTeams);
    expect(map.get('carol')).toBeCloseTo(42, 5);
  });

  it('equivalence: single-team shooter output equals computeShooterAverage (F-02)', () => {
    // Pins that the map and the engine share ONE blend implementation: for a
    // shooter on a single team, the map value must equal computeShooterAverage
    // over the same scores (rounded to the map's 1-decimal display convention).
    const cases: { startingAvg: number; scores: number[] }[] = [
      { startingAvg: 43, scores: [38] },           // <2 weeks: blend applies
      { startingAvg: 35, scores: [40, 42] },       // exactly 2: blend phased out
      { startingAvg: 30, scores: [40, 42, 47] },   // 3+: raw mean
      { startingAvg: 41, scores: [25] },           // low single score
    ];
    for (const { startingAvg, scores } of cases) {
      const priorTeams = [makeTeam('Team', [makeShooter('Eve', startingAvg)])];
      const weeks = scores.map((total, i) => ({
        ...makeWeekResult([{ name: 'Eve', total }]),
        weekNumber: i + 1,
      }));
      const map = buildPriorAvgMap(weeks, priorTeams);
      const expected = parseFloat(
        computeShooterAverage(startingAvg, scores, scores.length - 1).toFixed(1),
      );
      expect(map.get('eve'), `startingAvg=${startingAvg} scores=[${scores}]`).toBe(expected);
    }
  });

  it('startingAvg: 0 in priorTeams is treated as 35 for blending (corrupt/legacy data)', () => {
    // If a prior-year shooter has startingAvg stored as 0, blending should use 35.
    // Without the guard: (0 + 38) / 2 = 19. With the guard: (35 + 38) / 2 = 36.5.
    const priorTeams = [makeTeam('Team', [makeShooter('Eve', 0)])];
    const weeks = [makeWeekResult([{ name: 'Eve', total: 38 }])];
    const map = buildPriorAvgMap(weeks, priorTeams);
    expect(map.get('eve')).toBe(36.5);
  });

  it('shooter not in priorTeams gets default startingAvg=35 for the 1-week blend', () => {
    // No team data → startingAvg defaults to 35. Blended: (35 + 38) / 2 = 36.5
    const weeks = [makeWeekResult([{ name: 'Unknown', total: 38 }])];
    const map = buildPriorAvgMap(weeks, []);
    expect(map.get('unknown')).toBe(36.5);
  });

  it('name lookup is case-insensitive across week results and team list', () => {
    const priorTeams = [makeTeam('Team', [makeShooter('Alice Smith', 43)])];
    const weeks = [makeWeekResult([{ name: 'alice smith', total: 38 }])];
    const map = buildPriorAvgMap(weeks, priorTeams);
    expect(map.get('alice smith')).toBe(40.5);
  });

  it('handles multiple shooters independently', () => {
    const priorTeams = [makeTeam('Team', [
      makeShooter('Alice', 43),
      makeShooter('Bob', 35),
    ])];
    const weeks = [
      makeWeekResult([
        { name: 'Alice', total: 38 }, // 1 week: (43+38)/2 = 40.5
        { name: 'Bob', total: 40 },   // 1 week: (35+40)/2 = 37.5
      ]),
      {
        ...makeWeekResult([{ name: 'Bob', total: 42 }]), // Bob shoots again → 2 weeks: (40+42)/2 = 41
        weekNumber: 2,
      },
    ];
    const map = buildPriorAvgMap(weeks, priorTeams);
    expect(map.get('alice')).toBe(40.5);
    expect(map.get('bob')).toBe(41);
  });
});

// ---------------------------------------------------------------------------
// computeShooterDefaults
// ---------------------------------------------------------------------------

describe('computeShooterDefaults', () => {
  it('returns VALIDATION_ERROR for invalid year', async () => {
    const svc = new ScoreService(makeRepo({}));
    const result = await svc.computeShooterDefaults(2000, 'Alice');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR for blank shooterName', async () => {
    const svc = new ScoreService(makeRepo({}));
    const result = await svc.computeShooterDefaults(2026, '   ');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('regression: 1 week shot — blends startingAvg into final avg (was returning raw score)', async () => {
    // Alice shot once last year (total=38) with a prior going-in avg of 43.
    // Correct: mean([43, 38]) = 40.5.  Bug: raw mean = 38 / 1 = 38.
    const svc = new ScoreService(
      makeRepo({
        prior1Teams: [makeTeam('Shooters', [makeShooter('Alice', 43)])],
        prior1Weeks: [makeWeekResult([{ name: 'Alice', total: 38 }])],
      }),
    );
    const result = await svc.computeShooterDefaults(2026, 'Alice');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startingAvg).toBe(40.5);
      expect(result.data.rookie).toBe(false);
    }
  });

  it('2+ weeks shot — startingAvg is phased out, uses raw mean of scores', async () => {
    // Bob shot 3 times: 40 + 42 + 44 = 126. startingAvg=35 must NOT be included.
    const svc = new ScoreService(
      makeRepo({
        prior1Teams: [makeTeam('Shooters', [makeShooter('Bob', 35)])],
        prior1Weeks: [
          makeWeekResult([{ name: 'Bob', total: 40 }]),
          { ...makeWeekResult([{ name: 'Bob', total: 42 }]), weekNumber: 2 },
          { ...makeWeekResult([{ name: 'Bob', total: 44 }]), weekNumber: 3 },
        ],
      }),
    );
    const result = await svc.computeShooterDefaults(2026, 'Bob');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startingAvg).toBeCloseTo(42, 5);
      expect(result.data.rookie).toBe(false);
    }
  });

  it('brand-new shooter — defaults to 35 / rookie:true', async () => {
    const svc = new ScoreService(makeRepo({ prior1Teams: [], prior2Teams: [] }));
    const result = await svc.computeShooterDefaults(2026, 'NewGuy');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startingAvg).toBe(35);
      expect(result.data.rookie).toBe(true);
    }
  });

  it('shooter in prior2 roster only with no week results — startingAvg=35, rookie:true', async () => {
    // On prior2 roster but no shooting record in either year → rookie per business rule.
    // startingAvg=35 because finalAvg is null (never shot) and no WeekResult entries exist.
    const svc = new ScoreService(
      makeRepo({
        prior1Teams: [],
        prior2Teams: [makeTeam('Old Team', [makeShooter('Veteran', 38)])],
        prior1Weeks: [],
        prior2Weeks: [],
      }),
    );
    const result = await svc.computeShooterDefaults(2026, 'Veteran');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startingAvg).toBe(35);
      expect(result.data.rookie).toBe(true);
    }
  });

  it('name matching is case-insensitive', async () => {
    const svc = new ScoreService(
      makeRepo({
        prior1Teams: [makeTeam('Team', [makeShooter('alice smith', 43)])],
        prior1Weeks: [makeWeekResult([{ name: 'alice smith', total: 38 }])],
      }),
    );
    const result = await svc.computeShooterDefaults(2026, 'Alice Smith');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startingAvg).toBe(40.5);
    }
  });

  it('returns 35 when prior-year roster has finalAvg: 0 (corrupt/legacy data)', async () => {
    // Shooter was on prior-year roster with finalAvg stored as 0 instead of null.
    // Should fall back to the 35 default, not return 0.
    const svc = new ScoreService(
      makeRepo({
        prior1Teams: [makeTeam('Team', [makeShooter('Dave', 35, 0)])],
        prior1Weeks: [],
      }),
    );
    const result = await svc.computeShooterDefaults(2026, 'Dave');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startingAvg).toBe(35);
    }
  });

  it('falls back to finalAvg on team doc when not in published week results', async () => {
    // Charlie is on the prior-year roster with finalAvg=41 but has no WeekResult entries
    // (e.g. historical season before publish was used).
    const svc = new ScoreService(
      makeRepo({
        prior1Teams: [makeTeam('Team', [makeShooter('Charlie', 35, 41)])],
        prior1Weeks: [],
      }),
    );
    const result = await svc.computeShooterDefaults(2026, 'Charlie');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startingAvg).toBe(41);
    }
  });

  // Bug #140 — Bug B: shooter skipped N-1 but shot in N-2
  it('falls back to prior2 avg when shooter did not shoot in prior1 but shot in prior2', async () => {
    const svc = new ScoreService(
      makeRepo({
        prior1Teams: [makeTeam('Team', [makeShooter('Eve', 35)])],
        prior1Weeks: [],  // Eve did not shoot in N-1
        prior2Teams: [makeTeam('Team', [makeShooter('Eve', 35)])],
        prior2Weeks: [   // Eve shot twice in N-2 → avg = (40+42)/2 = 41
          makeWeekResult([{ name: 'Eve', total: 40 }]),
          { ...makeWeekResult([{ name: 'Eve', total: 42 }]), weekNumber: 2 },
        ],
      }),
    );
    const result = await svc.computeShooterDefaults(2026, 'Eve');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startingAvg).toBe(41);
      expect(result.data.rookie).toBe(false);
    }
  });

  // Bug #140 — Bug A: shooter on roster both years but never shot → rookie
  it('returns rookie:true when shooter on roster in both prior years but shot in neither', async () => {
    const svc = new ScoreService(
      makeRepo({
        prior1Teams: [makeTeam('Team', [makeShooter('Frank', 35)])],
        prior1Weeks: [],
        prior2Teams: [makeTeam('Team', [makeShooter('Frank', 35)])],
        prior2Weeks: [],
      }),
    );
    const result = await svc.computeShooterDefaults(2026, 'Frank');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startingAvg).toBe(35);
      expect(result.data.rookie).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// computeRosterDefaults
// ---------------------------------------------------------------------------

describe('computeRosterDefaults', () => {
  it('returns NOT_FOUND when team does not exist', async () => {
    const svc = new ScoreService(makeRepo({ currentTeam: null }));
    const result = await svc.computeRosterDefaults(2026, 'missing-team');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('NOT_FOUND');
  });

  it('regression: 1 week shot — blends startingAvg for roster shooters too', async () => {
    const alice = makeShooter('Alice', 43);
    const team = makeTeam('Shooters', [alice]);

    const svc = new ScoreService(
      makeRepo({
        currentTeam: team,
        prior1Teams: [makeTeam('Shooters', [makeShooter('Alice', 43)])],
        prior1Weeks: [makeWeekResult([{ name: 'Alice', total: 38 }])],
      }),
    );
    const result = await svc.computeRosterDefaults(2026, 'shooters');
    expect(result.success).toBe(true);
    if (result.success) {
      const shooterResult = result.data.shooters.find((s) => s.name === 'Alice');
      expect(shooterResult?.startingAvg).toBe(40.5);
      expect(shooterResult?.rookie).toBe(false);
    }
  });

  it('2+ weeks shot — startingAvg phased out for existing roster shooter', async () => {
    const bob = makeShooter('Bob', 35);
    const team = makeTeam('Team', [bob]);

    const svc = new ScoreService(
      makeRepo({
        currentTeam: team,
        prior1Teams: [makeTeam('Team', [makeShooter('Bob', 35)])],
        prior1Weeks: [
          makeWeekResult([{ name: 'Bob', total: 40 }]),
          { ...makeWeekResult([{ name: 'Bob', total: 42 }]), weekNumber: 2 },
        ],
      }),
    );
    const result = await svc.computeRosterDefaults(2026, 'team');
    expect(result.success).toBe(true);
    if (result.success) {
      const shooterResult = result.data.shooters.find((s) => s.name === 'Bob');
      expect(shooterResult?.startingAvg).toBe(41);
    }
  });

  it('new shooter on roster — defaults to 35 / rookie:true', async () => {
    const newGuy = makeShooter('NewGuy', 35);
    const team = makeTeam('Team', [newGuy]);

    const svc = new ScoreService(
      makeRepo({
        currentTeam: team,
        prior1Teams: [],
        prior2Teams: [],
        prior1Weeks: [],
      }),
    );
    const result = await svc.computeRosterDefaults(2026, 'team');
    expect(result.success).toBe(true);
    if (result.success) {
      const shooterResult = result.data.shooters.find((s) => s.name === 'NewGuy');
      expect(shooterResult?.startingAvg).toBe(35);
      expect(shooterResult?.rookie).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// buildScorecardData — service-layer data assembly for season-scorecards
// ---------------------------------------------------------------------------

/**
 * Repository stub that dispatches by year. `currentYear` resolves the
 * current season's teams + weeks; the prior 1 and prior 2 years resolve from
 * their own slots. Anything else returns empty.
 */
function makeScorecardRepo(opts: {
  currentYear: number;
  currentTeams?: Team[];
  currentWeeks?: WeekResult[];
  prior1Teams?: Team[];
  prior2Teams?: Team[];
  prior1Weeks?: WeekResult[];
  prior2Weeks?: WeekResult[];
}): ScoreRepository {
  const y = opts.currentYear;
  const stub: Partial<ScoreRepository> = {
    getTeams: async (year) => {
      if (year === y) return success(opts.currentTeams ?? []);
      if (year === y - 1) return success(opts.prior1Teams ?? []);
      if (year === y - 2) return success(opts.prior2Teams ?? []);
      return success([]);
    },
    getAllWeekResults: async (year) => {
      if (year === y) return success(opts.currentWeeks ?? []);
      if (year === y - 1) return success(opts.prior1Weeks ?? []);
      if (year === y - 2) return success(opts.prior2Weeks ?? []);
      return success([]);
    },
  };
  return stub as unknown as ScoreRepository;
}

function makeFullWeekResult(opts: {
  weekNumber: number;
  teamName: string;
  teamId?: string;
  targets?: number;
  rankPoints?: number;
  bonusPoints?: number;
  shooterScores: { name: string; total: number }[];
}): WeekResult {
  return {
    weekNumber: opts.weekNumber,
    publishedAt: '',
    teamResults: [
      {
        teamId: opts.teamId ?? opts.teamName.toLowerCase(),
        teamName: opts.teamName,
        targets: opts.targets ?? 0,
        rankPoints: opts.rankPoints ?? 0,
        bonusPoints: opts.bonusPoints ?? 0,
        shooterScores: opts.shooterScores.map((s) => ({
          name: s.name,
          score1: null,
          score2: null,
          total: s.total,
        })),
      },
    ],
  };
}

describe('buildScorecardData', () => {
  it('returns VALIDATION_ERROR for out-of-range year', async () => {
    const svc = new ScoreService(makeScorecardRepo({ currentYear: 2026 }));
    const result = await svc.buildScorecardData(2000);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('returns an empty teams array when no data exists for the year', async () => {
    const svc = new ScoreService(makeScorecardRepo({ currentYear: 2026 }));
    const result = await svc.buildScorecardData(2026);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.teams).toEqual([]);
  });

  it('builds one block per rostered team, in roster order', async () => {
    const teamA = makeTeam('Alpha', [makeRosterShooter('A1'), makeRosterShooter('A2')]);
    const teamB = makeTeam('Bravo', [makeRosterShooter('B1'), makeRosterShooter('B2')]);
    const svc = new ScoreService(makeScorecardRepo({
      currentYear: 2026,
      currentTeams: [teamA, teamB],
    }));
    const result = await svc.buildScorecardData(2026);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.teams.map((b) => b.teamName)).toEqual(['Alpha', 'Bravo']);
    }
  });

  it('appends teams that appear only in week results (no current roster doc)', async () => {
    const teamA = makeTeam('Alpha', [makeRosterShooter('A1')]);
    const orphanWeek = makeFullWeekResult({
      weekNumber: 1, teamName: 'Ghost', shooterScores: [{ name: 'G1', total: 40 }],
    });
    const svc = new ScoreService(makeScorecardRepo({
      currentYear: 2026,
      currentTeams: [teamA],
      currentWeeks: [orphanWeek],
    }));
    const result = await svc.buildScorecardData(2026);
    expect(result.success).toBe(true);
    if (result.success) {
      const names = result.data.teams.map((b) => b.teamName);
      expect(names).toEqual(['Alpha', 'Ghost']);
    }
  });

  it('regression #141 — applies prior2AvgMap fallback to scorecard rows (matches computeRosterDefaults)', async () => {
    // Eve was on the roster both N-1 and N-2, did not shoot in N-1, but shot
    // twice in N-2 averaging (40+42)/2 = 41. The scorecard view must show 41,
    // not the new-shooter default of 35.
    const team = makeTeam('Team', [makeRosterShooter('Eve')]);
    const prior1Team = makeTeam('Team', [makeShooter('Eve', 35)]);
    const prior2Team = makeTeam('Team', [makeShooter('Eve', 35)]);
    const prior2Weeks: WeekResult[] = [
      makeWeekResult([{ name: 'Eve', total: 40 }]),
      { ...makeWeekResult([{ name: 'Eve', total: 42 }]), weekNumber: 2 },
    ];

    const svc = new ScoreService(makeScorecardRepo({
      currentYear: 2026,
      currentTeams: [team],
      prior1Teams: [prior1Team],
      prior1Weeks: [],
      prior2Teams: [prior2Team],
      prior2Weeks,
    }));

    const result = await svc.buildScorecardData(2026);
    expect(result.success).toBe(true);
    if (result.success) {
      const eveRow = result.data.teams[0]!.shooters.find((s) => s.name === 'Eve');
      expect(eveRow?.w0Display).toBe(41);
      expect(eveRow?.rookie).toBe(false);
    }
  });

  it('regression #141 — flags roster-only shooter as rookie when never shot in prior years', async () => {
    // Frank on roster both prior years but published no scores → rookie.
    const team = makeTeam('Team', [makeRosterShooter('Frank')]);
    const prior1Team = makeTeam('Team', [makeShooter('Frank', 35)]);
    const prior2Team = makeTeam('Team', [makeShooter('Frank', 35)]);

    const svc = new ScoreService(makeScorecardRepo({
      currentYear: 2026,
      currentTeams: [team],
      prior1Teams: [prior1Team],
      prior2Teams: [prior2Team],
    }));

    const result = await svc.buildScorecardData(2026);
    expect(result.success).toBe(true);
    if (result.success) {
      const frankRow = result.data.teams[0]!.shooters.find((s) => s.name === 'Frank');
      expect(frankRow?.rookie).toBe(true);
    }
  });

  it('pads each team to 2 DUMMY rows when fewer dummies exist on the roster', async () => {
    const team = makeTeam('Hawks', [
      makeRosterShooter('A'),
      makeRosterShooter('B'),
      makeRosterShooter('C'),
    ]);
    const svc = new ScoreService(makeScorecardRepo({
      currentYear: 2026,
      currentTeams: [team],
    }));
    const result = await svc.buildScorecardData(2026);
    expect(result.success).toBe(true);
    if (result.success) {
      const dummies = result.data.teams[0]!.shooters.filter((s) => s.isDummy);
      expect(dummies.map((d) => d.name)).toEqual(['Hawks DUMMY1', 'Hawks DUMMY2']);
    }
  });

  it('sorts captain first among real shooters and pushes dummies last', async () => {
    const team: Team = {
      id: 'team',
      name: 'Team',
      captain: 'Bob',
      shooters: [
        makeRosterShooter('Alice'),
        makeRosterShooter('Bob'),
        makeRosterShooter('Carol'),
        makeRosterShooter('Team DUMMY1'),
        makeRosterShooter('Team DUMMY2'),
      ],
      totals: { targets: [], rankPoints: [], bonusPoints: [] },
    };
    const svc = new ScoreService(makeScorecardRepo({
      currentYear: 2026,
      currentTeams: [team],
    }));
    const result = await svc.buildScorecardData(2026);
    expect(result.success).toBe(true);
    if (result.success) {
      const order = result.data.teams[0]!.shooters.map((s) => s.name);
      expect(order[0]).toBe('Bob');
      expect(order.slice(-2).every((n) => n.includes('DUMMY'))).toBe(true);
    }
  });

  it('computes dummy W0 display = mean of real teammates W1 scores', async () => {
    // Real W1 scores: 40 and 50 → dummy W0 display = 45
    const team = makeTeam('Team', [
      makeRosterShooter('A'),
      makeRosterShooter('B'),
      makeRosterShooter('Team DUMMY1'),
    ]);
    const week = makeFullWeekResult({
      weekNumber: 1, teamName: 'Team',
      targets: 130, rankPoints: 30, bonusPoints: 5,
      shooterScores: [
        { name: 'A', total: 40 },
        { name: 'B', total: 50 },
        { name: 'Team DUMMY1', total: 40 },
      ],
    });
    const svc = new ScoreService(makeScorecardRepo({
      currentYear: 2026,
      currentTeams: [team],
      currentWeeks: [week],
    }));
    const result = await svc.buildScorecardData(2026);
    expect(result.success).toBe(true);
    if (result.success) {
      const dummy = result.data.teams[0]!.shooters.find((s) => s.name === 'Team DUMMY1');
      expect(dummy?.w0Display).toBe(45);
    }
  });

  it('carries through targets, rankPoints, and bonusPoints from week results', async () => {
    const team = makeTeam('Team', [makeRosterShooter('A')]);
    const week = makeFullWeekResult({
      weekNumber: 1, teamName: 'Team',
      targets: 200, rankPoints: 28, bonusPoints: 3,
      shooterScores: [{ name: 'A', total: 40 }],
    });
    const svc = new ScoreService(makeScorecardRepo({
      currentYear: 2026,
      currentTeams: [team],
      currentWeeks: [week],
    }));
    const result = await svc.buildScorecardData(2026);
    expect(result.success).toBe(true);
    if (result.success) {
      const block = result.data.teams[0]!;
      expect(block.targets[0]).toBe(200);
      expect(block.rankPoints[0]).toBe(28);
      expect(block.bonusPoints[0]).toBe(3);
    }
  });

  it('does not re-add non-dummy shooters removed from the roster but still in week results', async () => {
    // Charlie was on a published week but is no longer on the roster — must be dropped.
    const team = makeTeam('Team', [makeRosterShooter('A')]);
    const week = makeFullWeekResult({
      weekNumber: 1, teamName: 'Team',
      shooterScores: [
        { name: 'A', total: 40 },
        { name: 'Charlie', total: 38 },
      ],
    });
    const svc = new ScoreService(makeScorecardRepo({
      currentYear: 2026,
      currentTeams: [team],
      currentWeeks: [week],
    }));
    const result = await svc.buildScorecardData(2026);
    expect(result.success).toBe(true);
    if (result.success) {
      const names = result.data.teams[0]!.shooters.map((s) => s.name);
      expect(names).not.toContain('Charlie');
    }
  });
});

// ---------------------------------------------------------------------------
// saveTeamRoster — minimum shooter count
// ---------------------------------------------------------------------------

function makeRosterShooter(name: string): Shooter {
  return {
    id: '',
    name,
    rookie: false,
    startingAvg: 35,
    finalAvg: null,
    weeksShot: null,
    scores: new Array<number | null>(15).fill(null),
  };
}

describe('saveTeamRoster — minimum shooter count', () => {
  it('returns VALIDATION_ERROR when fewer than 5 shooters provided', async () => {
    const svc = new ScoreService(makeRepo({}));
    const result = await svc.saveTeamRoster(2026, 'team-1', 'Captain', [
      makeRosterShooter('Alice'),
      makeRosterShooter('Bob'),
    ]);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR when exactly 4 shooters provided', async () => {
    const svc = new ScoreService(makeRepo({}));
    const result = await svc.saveTeamRoster(2026, 'team-1', 'Captain', [
      makeRosterShooter('Alice'),
      makeRosterShooter('Bob'),
      makeRosterShooter('Carol'),
      makeRosterShooter('Dave'),
    ]);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('does not fail the minimum check when exactly 5 shooters provided', async () => {
    const team = makeTeam('Team', []);
    const repo: Partial<ScoreRepository> = {
      getTeam: async () => success(team),
      saveTeamRoster: async () => success(undefined),
    };
    const svc = new ScoreService(repo as unknown as ScoreRepository);
    const result = await svc.saveTeamRoster(2026, 'team-1', 'Captain', [
      makeRosterShooter('Alice'),
      makeRosterShooter('Bob'),
      makeRosterShooter('Carol'),
      makeRosterShooter('Dave'),
      makeRosterShooter('Eve'),
    ]);
    // The count guard must NOT be what rejected this
    if (!result.success) {
      expect(result.code).not.toBe('VALIDATION_ERROR');
    }
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// deleteTeam — validation
// ---------------------------------------------------------------------------

describe('removeShooterFromRoster — validation', () => {
  it('returns VALIDATION_ERROR for out-of-range year', async () => {
    const svc = new ScoreService(makeRepo({}));
    const result = await svc.removeShooterFromRoster(2000, 'team-1', 'Alice');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR for blank shooterName', async () => {
    const svc = new ScoreService(makeRepo({}));
    const result = await svc.removeShooterFromRoster(2026, 'team-1', '   ');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('returns NOT_FOUND when team does not exist', async () => {
    const repo: Partial<ScoreRepository> = {
      getTeam: async () => success(null),
    };
    const svc = new ScoreService(repo as unknown as ScoreRepository);
    const result = await svc.removeShooterFromRoster(2026, 'team-1', 'Alice');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('NOT_FOUND');
  });

  it('returns NOT_FOUND when shooter is not on the roster', async () => {
    const team = makeTeam('Team', [makeRosterShooter('Bob')]);
    const repo: Partial<ScoreRepository> = {
      getTeam: async () => success(team),
    };
    const svc = new ScoreService(repo as unknown as ScoreRepository);
    const result = await svc.removeShooterFromRoster(2026, 'team-1', 'Alice');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('NOT_FOUND');
  });

  it('clears the teams cache on successful removal — next getTeams hits the repository', async () => {
    const team = makeTeam('Team', [makeRosterShooter('Alice')]);
    let getTeamsCalls = 0;
    const repo: Partial<ScoreRepository> = {
      getTeams: async () => { getTeamsCalls++; return success([team]); },
      getTeam: async () => success(team),
      getEntry: async () => success(null),
      getAllWeekResults: async () => success([]),
      removeShooterFromRosterAndEntries: async () => success(undefined),
    };
    const svc = new ScoreService(repo as unknown as ScoreRepository);
    await svc.getTeams(2026); // populate cache
    await svc.getTeams(2026); // served from cache
    expect(getTeamsCalls).toBe(1);
    const result = await svc.removeShooterFromRoster(2026, 'team-1', 'Alice');
    expect(result.success).toBe(true);
    await svc.getTeams(2026); // invalidated — must re-fetch
    expect(getTeamsCalls).toBe(2);
  });

  it('returns failure when the accolade-cleanup weeks read fails (nothing written) — F-25', async () => {
    const team = makeTeam('Team', [makeRosterShooter('Alice')]);
    let wrote = false;
    const repo: Partial<ScoreRepository> = {
      getTeam: async () => success(team),
      getEntry: async () => success(null),
      getAllWeekResults: async () => failure('network down', 'FIRESTORE_READ_ERROR'),
      removeShooterFromRosterAndEntries: async () => { wrote = true; return success(undefined); },
    };
    const svc = new ScoreService(repo as unknown as ScoreRepository);
    const result = await svc.removeShooterFromRoster(2026, 'team-1', 'Alice');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('FIRESTORE_READ_ERROR');
    expect(wrote).toBe(false); // failed before any write — retry is clean
  });
});

describe('deleteTeam — validation', () => {
  it('returns VALIDATION_ERROR for out-of-range year', async () => {
    const svc = new ScoreService(makeRepo({}));
    const result = await svc.deleteTeam(2000, 'team-1');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR for blank teamId', async () => {
    const svc = new ScoreService(makeRepo({}));
    const result = await svc.deleteTeam(2026, '');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('clears the teams cache on successful deletion — next getTeams hits the repository', async () => {
    let getTeamsCalls = 0;
    const repo: Partial<ScoreRepository> = {
      getTeams: async () => { getTeamsCalls++; return success([]); },
      deleteTeam: async () => success(undefined),
      getAllWeekResults: async () => success([]),
    };
    const svc = new ScoreService(repo as unknown as ScoreRepository);
    await svc.getTeams(2026); // populate cache
    await svc.getTeams(2026); // served from cache
    expect(getTeamsCalls).toBe(1);
    const result = await svc.deleteTeam(2026, 'team-1');
    expect(result.success).toBe(true);
    await svc.getTeams(2026); // invalidated — must re-fetch
    expect(getTeamsCalls).toBe(2);
  });

  it('returns STANDINGS_RECOMPUTE_FAILED when the weeks read fails after deletion (F-25)', async () => {
    const repo: Partial<ScoreRepository> = {
      deleteTeam: async () => success(undefined),
      getAllWeekResults: async () => failure('network down', 'FIRESTORE_READ_ERROR'),
    };
    const svc = new ScoreService(repo as unknown as ScoreRepository);
    const result = await svc.deleteTeam(2026, 'team-1');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('STANDINGS_RECOMPUTE_FAILED');
  });

  it('returns STANDINGS_RECOMPUTE_FAILED when the standings write fails after deletion (F-25)', async () => {
    const repo: Partial<ScoreRepository> = {
      deleteTeam: async () => success(undefined),
      getAllWeekResults: async () => success([makeWeekResult([{ name: 'A', total: 40 }])]),
      updateSeason: async () => failure('write denied', 'FIRESTORE_WRITE_ERROR'),
    };
    const svc = new ScoreService(repo as unknown as ScoreRepository);
    const result = await svc.deleteTeam(2026, 'team-1');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('STANDINGS_RECOMPUTE_FAILED');
  });
});

// ---------------------------------------------------------------------------
// Cache behavior — hit, TTL expiry, null caching, prior-year routing
// ---------------------------------------------------------------------------

describe('ScoreService cache (F-30, F-48)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('getTeams: repeated calls within TTL issue exactly one repository read', async () => {
    let calls = 0;
    const repo: Partial<ScoreRepository> = {
      getTeams: async () => { calls++; return success([]); },
    };
    const svc = new ScoreService(repo as unknown as ScoreRepository);
    await svc.getTeams(2026);
    await svc.getTeams(2026);
    await svc.getTeams(2026);
    expect(calls).toBe(1);
  });

  it('getTeams: re-fetches after CACHE_TTL_MS (1 hr) expires', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const repo: Partial<ScoreRepository> = {
      getTeams: async () => { calls++; return success([]); },
    };
    const svc = new ScoreService(repo as unknown as ScoreRepository);
    await svc.getTeams(2026);
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    await svc.getTeams(2026);
    expect(calls).toBe(2);
  });

  it('getSeason: caches null — repeated lookups of a missing season hit the repo once (F-48)', async () => {
    let calls = 0;
    const repo: Partial<ScoreRepository> = {
      getSeason: async () => { calls++; return success(null); },
    };
    const svc = new ScoreService(repo as unknown as ScoreRepository);
    const r1 = await svc.getSeason(2030);
    const r2 = await svc.getSeason(2030);
    expect(r1.success && r1.data === null).toBe(true);
    expect(r2.success && r2.data === null).toBe(true);
    expect(calls).toBe(1);
  });

  it('computeRosterDefaults: prior-year reads are cached — second call issues no new repo reads (F-48)', async () => {
    const team = makeTeam('Team', [makeShooter('Alice', 40)]);
    let teamsCalls = 0;
    let weeksCalls = 0;
    const repo: Partial<ScoreRepository> = {
      getTeam: async () => success(team),
      getTeams: async () => { teamsCalls++; return success([]); },
      getAllWeekResults: async () => { weeksCalls++; return success([]); },
    };
    const svc = new ScoreService(repo as unknown as ScoreRepository);
    await svc.computeRosterDefaults(2026, 'team');
    expect(teamsCalls).toBe(2); // year-1 and year-2
    expect(weeksCalls).toBe(2);
    await svc.computeRosterDefaults(2026, 'team');
    expect(teamsCalls).toBe(2); // served from cache
    expect(weeksCalls).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// publishWeek
// ---------------------------------------------------------------------------

/**
 * Build a minimal SeasonEntry for publishWeek tests.
 * Scores default to 20/20 (total 40) per shooter unless overridden.
 */
function makeEntry(opts: {
  weekNumber: number;
  teamId: string;
  teamName: string;
  shooters: { name: string; score1?: number; score2?: number }[];
}): SeasonEntry {
  return {
    year: 2026,
    weekNumber: opts.weekNumber,
    teamId: opts.teamId,
    teamName: opts.teamName,
    savedAt: '',
    shooters: opts.shooters.map((s) => {
      const s1 = s.score1 ?? 20;
      const s2 = s.score2 ?? 20;
      return { name: s.name, score1: s1, score2: s2, total: s1 + s2 };
    }),
  };
}

/** Build a team whose shooter names match those in a given entry. */
function makeTeamFromEntry(entry: SeasonEntry, extraShooters: string[] = []): Team {
  const names = [...entry.shooters.map((s) => s.name), ...extraShooters];
  return {
    id: entry.teamId,
    name: entry.teamName,
    captain: '',
    shooters: names.map((n) => makeShooter(n, 35)),
    totals: { targets: [], rankPoints: [], bonusPoints: [] },
  };
}

/** Minimal repo stub for publishWeek — captures what is written to Firestore. */
function makePublishRepo(opts: {
  entries?: SeasonEntry[];
  teams?: Team[];
  season?: Season | null;
  onPublish?: (wr: WeekResult, su: object) => void;
}): ScoreRepository {
  const stub: Partial<ScoreRepository> = {
    getEntries: async () => success(opts.entries ?? []),
    getTeams: async () => success(opts.teams ?? []),
    getSeason: async () => success(opts.season ?? null),
    publishWeek: async (_y, wr, su) => {
      opts.onPublish?.(wr, su as object);
      return success({ weekResult: wr, seasonUpdates: su });
    },
  };
  return stub as unknown as ScoreRepository;
}

describe('publishWeek — input validation', () => {
  it('returns VALIDATION_ERROR for out-of-range year', async () => {
    const svc = new ScoreService(makePublishRepo({}));
    const result = await svc.publishWeek(2000, 1);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR for weekNumber 0', async () => {
    const svc = new ScoreService(makePublishRepo({}));
    const result = await svc.publishWeek(2026, 0);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR for weekNumber 16', async () => {
    const svc = new ScoreService(makePublishRepo({}));
    const result = await svc.publishWeek(2026, 16);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('returns NO_DATA when no entries exist for any week up to weekNumber', async () => {
    const svc = new ScoreService(makePublishRepo({ entries: [] }));
    const result = await svc.publishWeek(2026, 1);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('NO_DATA');
  });

  it('returns VALIDATION_ERROR when a team has 3 dummy shooters in the target week', async () => {
    const entry = makeEntry({
      weekNumber: 1,
      teamId: 'ravens',
      teamName: 'Ravens',
      shooters: [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Ravens DUMMY1' }, // isDummyName → true
        { name: 'Ravens DUMMY2' }, // isDummyName → true
        { name: 'Ravens DUMMY3' }, // isDummyName → true  ← 3 dummies, over limit
      ],
    });
    const team = makeTeamFromEntry(entry);
    const svc = new ScoreService(makePublishRepo({ entries: [entry], teams: [team] }));
    const result = await svc.publishWeek(2026, 1);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('VALIDATION_ERROR');
  });
});

describe('publishWeek — happy path: WeekResult structure', () => {
  it('writes a WeekResult with the correct weekNumber and one result per team', async () => {
    const entryA = makeEntry({ weekNumber: 1, teamId: 'team-a', teamName: 'Team A',
      shooters: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }] });
    const entryB = makeEntry({ weekNumber: 1, teamId: 'team-b', teamName: 'Team B',
      shooters: [{ name: 'V' }, { name: 'W' }, { name: 'X' }, { name: 'Y' }, { name: 'Z' }] });

    let captured: WeekResult | undefined;
    const svc = new ScoreService(makePublishRepo({
      entries: [entryA, entryB],
      teams: [makeTeamFromEntry(entryA), makeTeamFromEntry(entryB)],
      onPublish: (wr) => { captured = wr; },
    }));

    const result = await svc.publishWeek(2026, 1);
    expect(result.success).toBe(true);
    expect(captured?.weekNumber).toBe(1);
    expect(captured?.teamResults).toHaveLength(2);
  });
});

describe('publishWeek — standings computation', () => {
  it('ranks the higher-scoring team first', async () => {
    // Team A: 5 shooters × 43 = 215 targets.  Team B: 5 shooters × 35 = 175 targets.
    // Going-in avg = 35 for all (week 1, no prior scores) → goingInSum = 175 each.
    // Team A targets (215) > goingInSum (175) → target bonus = 5.
    // Team B targets (175) = goingInSum (175) → NOT strictly greater → bonus = 0.
    // Rank points: Team A = 30, Team B = 28.
    // Final: Team A = 35 pts, Team B = 28 pts → Team A rank 1.
    const entryA = makeEntry({ weekNumber: 1, teamId: 'team-a', teamName: 'Team A',
      shooters: [
        { name: 'A', score1: 21, score2: 22 },
        { name: 'B', score1: 21, score2: 22 },
        { name: 'C', score1: 21, score2: 22 },
        { name: 'D', score1: 21, score2: 22 },
        { name: 'E', score1: 21, score2: 22 },
      ],
    });
    const entryB = makeEntry({ weekNumber: 1, teamId: 'team-b', teamName: 'Team B',
      shooters: [
        { name: 'V', score1: 17, score2: 18 },
        { name: 'W', score1: 17, score2: 18 },
        { name: 'X', score1: 17, score2: 18 },
        { name: 'Y', score1: 17, score2: 18 },
        { name: 'Z', score1: 17, score2: 18 },
      ],
    });

    let capturedStandings: SeasonStandings[] | undefined;
    const svc = new ScoreService(makePublishRepo({
      entries: [entryA, entryB],
      teams: [makeTeamFromEntry(entryA), makeTeamFromEntry(entryB)],
      onPublish: (_, su) => {
        capturedStandings = (su as { standings: SeasonStandings[] }).standings;
      },
    }));

    await svc.publishWeek(2026, 1);

    expect(capturedStandings?.[0]?.teamName).toBe('Team A');
    expect(capturedStandings?.[0]?.rank).toBe(1);
    expect(capturedStandings?.[1]?.teamName).toBe('Team B');
    expect(capturedStandings?.[1]?.rank).toBe(2);
  });

  it('forward publish sets currentWeek to the published week (no prior season)', async () => {
    const entry = makeEntry({ weekNumber: 3, teamId: 'team-a', teamName: 'Team A',
      shooters: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }] });

    let capturedUpdate: { currentWeek?: number } | undefined;
    const svc = new ScoreService(makePublishRepo({
      entries: [entry],
      teams: [makeTeamFromEntry(entry)],
      onPublish: (_, su) => { capturedUpdate = su as { currentWeek?: number }; },
    }));

    await svc.publishWeek(2026, 3);
    expect(capturedUpdate?.currentWeek).toBe(3);
  });

  it('republishing an earlier week does NOT rewind currentWeek (F-05)', async () => {
    const wk = (n: number) => makeEntry({ weekNumber: n, teamId: 'team-a', teamName: 'Team A',
      shooters: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }] });
    const entries = [wk(1), wk(2), wk(3), wk(4), wk(5)];

    let capturedUpdate: { currentWeek?: number } | undefined;
    const svc = new ScoreService(makePublishRepo({
      entries,
      teams: [makeTeamFromEntry(wk(1))],
      // Season already advanced to week 5.
      season: { currentWeek: 5 } as unknown as Season,
      onPublish: (_, su) => { capturedUpdate = su as { currentWeek?: number }; },
    }));

    // Correcting week 2 must not drop the season back to week 2.
    await svc.publishWeek(2026, 2);
    expect(capturedUpdate?.currentWeek).toBe(5);
  });

  it('never throws — a repository that throws yields a failure Result, not a wedged UI (F-09)', async () => {
    // The class contract promises no throws across module boundaries; the
    // admin UI relies on it to re-enable the Publishing… button.
    const throwingRepo: Partial<ScoreRepository> = {
      getSeason: async () => { throw new Error('boom'); },
    };
    const svc = new ScoreService(throwingRepo as unknown as ScoreRepository);
    const result = await svc.publishWeek(2026, 3);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('INTERNAL_ERROR');
  });

  it('derives teamId from the team document id, not a re-slugified name (F-08)', async () => {
    // Team was renamed mid-season: doc id is the original, name is the new display name.
    const entry = makeEntry({ weekNumber: 1, teamId: 'ignored', teamName: 'Renamed Team',
      shooters: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }] });
    const team: Team = { ...makeTeamFromEntry(entry), id: 'original-team-id' };

    let capturedWr: WeekResult | undefined;
    let capturedStandings: SeasonStandings[] | undefined;
    const svc = new ScoreService(makePublishRepo({
      entries: [entry],
      teams: [team],
      onPublish: (wr, su) => {
        capturedWr = wr;
        capturedStandings = (su as { standings: SeasonStandings[] }).standings;
      },
    }));

    await svc.publishWeek(2026, 1);
    // Not _slugify('Renamed Team') === 'renamed-team'.
    expect(capturedWr?.teamResults[0]?.teamId).toBe('original-team-id');
    expect(capturedStandings?.[0]?.teamId).toBe('original-team-id');
  });
});

describe('publishWeek — dummy auto-injection via _buildSeasonData', () => {
  it('auto-injects 2 dummies when team entry has only 3 real scorers', async () => {
    // Real scores: 40, 42, 44.  mean = 42.  dummyScore = floor(42 − 5) = 37.
    // Total targets = 40 + 42 + 44 + 37 + 37 = 200.
    const entry = makeEntry({
      weekNumber: 1, teamId: 'ravens', teamName: 'Ravens',
      shooters: [
        { name: 'A', score1: 20, score2: 20 }, // 40
        { name: 'B', score1: 21, score2: 21 }, // 42
        { name: 'C', score1: 22, score2: 22 }, // 44
      ],
    });
    // Roster has 5 shooters; entry only covers 3 → 2 dummies auto-injected
    const team = makeTeamFromEntry(entry, ['D', 'E']);

    let capturedWr: WeekResult | undefined;
    const svc = new ScoreService(makePublishRepo({
      entries: [entry],
      teams: [team],
      onPublish: (wr) => { capturedWr = wr; },
    }));

    await svc.publishWeek(2026, 1);

    const teamResult = capturedWr?.teamResults[0];
    expect(teamResult?.targets).toBe(200); // 40+42+44+37+37
  });

  it('does not inject dummies when team entry already has 5 scorers', async () => {
    const entry = makeEntry({
      weekNumber: 1, teamId: 'team-a', teamName: 'Team A',
      shooters: [
        { name: 'A', score1: 20, score2: 20 },
        { name: 'B', score1: 20, score2: 20 },
        { name: 'C', score1: 20, score2: 20 },
        { name: 'D', score1: 20, score2: 20 },
        { name: 'E', score1: 20, score2: 20 },
      ],
    });
    const team = makeTeamFromEntry(entry);

    let capturedWr: WeekResult | undefined;
    const svc = new ScoreService(makePublishRepo({
      entries: [entry],
      teams: [team],
      onPublish: (wr) => { capturedWr = wr; },
    }));

    await svc.publishWeek(2026, 1);

    const shooterScores = capturedWr?.teamResults[0]?.shooterScores ?? [];
    const dummies = shooterScores.filter((s) => s.name.toUpperCase().includes('DUMMY'));
    expect(dummies).toHaveLength(0);
    expect(capturedWr?.teamResults[0]?.targets).toBe(200); // 5 × 40
  });
});

describe('publishWeek — shooter-name normalization (F-51)', () => {
  it('matches a case-variant entry name to the rostered shooter — no phantom 35-avg duplicate', async () => {
    // Roster spelling is "John Smith" with a 45 going-in average; the saved
    // entry says "john smith". Pre-fix, the mismatch spawned a phantom
    // substitute with a fresh 35 average: team targets 220 then beat the
    // (wrong) going-in sum 4×45+35=215 and awarded a +5 bonus. Post-fix the
    // going-in sum is 5×45=225 and no bonus is due.
    const entry = makeEntry({
      weekNumber: 1,
      teamId: 'alphas',
      teamName: 'Alphas',
      shooters: ['john smith', 'Bob', 'Cal', 'Dan', 'Ed'].map((name) => ({
        name, score1: 22, score2: 22,
      })),
    });
    const team: Team = {
      id: 'alphas',
      name: 'Alphas',
      captain: '',
      shooters: ['John Smith', 'Bob', 'Cal', 'Dan', 'Ed'].map((n) => makeShooter(n, 45)),
      totals: { targets: [], rankPoints: [], bonusPoints: [] },
    };
    let captured: WeekResult | undefined;
    const svc = new ScoreService(makePublishRepo({
      entries: [entry],
      teams: [team],
      onPublish: (wr) => { captured = wr; },
    }));
    const result = await svc.publishWeek(2026, 1);
    expect(result.success).toBe(true);

    const tr = captured!.teamResults.find((t) => t.teamName === 'Alphas')!;
    const johns = tr.shooterScores.filter(
      (s) => s.name.toLowerCase().trim() === 'john smith',
    );
    expect(johns).toHaveLength(1); // no roster+entry duplicate
    expect(tr.shooterScores).toHaveLength(5); // exactly the 5 entry shooters
    expect(tr.targets).toBe(220);
    expect(tr.bonusPoints).toBe(0); // phantom 35-avg shooter would have made this 5
  });
});

describe('publishWeek — cache invalidation', () => {
  it('invalidates the season cache so the next getSeason call hits the repository', async () => {
    const season: Season = {
      id: '2026', year: 2026, status: 'active', currentWeek: 0, standings: [], awards: null,
    };
    const entry = makeEntry({ weekNumber: 1, teamId: 'team-a', teamName: 'Team A',
      shooters: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }] });

    let getSeasonCallCount = 0;
    const repo: Partial<ScoreRepository> = {
      getEntries: async () => success([entry]),
      getTeams: async () => success([makeTeamFromEntry(entry)]),
      getSeason: async () => { getSeasonCallCount++; return success(season); },
      publishWeek: async (_y, wr, su) => success({ weekResult: wr, seasonUpdates: su }),
    };
    const svc = new ScoreService(repo as unknown as ScoreRepository);

    await svc.getSeason(2026);          // call 1 — populates cache
    expect(getSeasonCallCount).toBe(1);

    // publishWeek reads the season doc directly (for the currentWeek high-water
    // mark, F-05) and then invalidates the season cache.
    await svc.publishWeek(2026, 1);
    const afterPublish = getSeasonCallCount;

    await svc.getSeason(2026);          // must bypass the invalidated cache → repo hit
    expect(getSeasonCallCount).toBe(afterPublish + 1);
  });
});
