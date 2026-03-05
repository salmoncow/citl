/**
 * @file scoring-engine.test.ts
 * Unit tests for all 12 exported functions in scoring-engine.ts.
 * All functions are pure — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import type { ScorecardShooter, SeasonData, Team as ScTeam, TeamTotals } from '@/types/scorecard';
import type { Team as PriorTeam } from '@/types/score';
import type { Shooter } from '@/types/shooter';
import {
  mean,
  isDummyName,
  normalizeShooterName,
  getLastWord,
  computeGoingInAverage,
  computeShooterAverage,
  computeTeamTargets,
  computeGoingInAverageSum,
  computeTargetBonus,
  computeRookieBonus,
  computeRankPoints,
  computeShooterStartingAvg,
  isShooterRookie,
  computeMostImprovedScore,
  computeSeasonAwards,
  computeSeasonTotals,
  computeDummyScore,
  sortShootersWithCaptainFirst,
} from './scoring-engine';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Returns a fresh 15-element all-null scores array. */
const nullScores15 = (): (number | null)[] => new Array<number | null>(15).fill(null);

/** Returns a 15-element array with `n` leading scores set to `score`. */
const nScores = (n: number, score: number): (number | null)[] => {
  const s = nullScores15();
  for (let i = 0; i < n; i++) s[i] = score;
  return s;
};

function makeScorecardShooter(
  name: string,
  startingAvg: number,
  scores: (number | null)[],
  opts: { rookie?: boolean; isDummy?: boolean } = {},
): ScorecardShooter {
  const weeksShot = scores.filter((s) => s !== null).length;
  return {
    name,
    rookie: opts.rookie ?? false,
    isDummy: opts.isDummy,
    startingAvg,
    scores,
    weeksShot: weeksShot > 0 ? weeksShot : null,
    finalAvg: startingAvg, // placeholder; scoring engine recomputes this
  };
}

function makeEmptyTotals(): TeamTotals {
  return {
    targets: nullScores15(),
    rankPoints: nullScores15(),
    bonusPoints: nullScores15(),
  };
}

function makePriorShooter(name: string, finalAvg: number | null): Shooter {
  return {
    id: '',
    name,
    rookie: false,
    startingAvg: 35,
    finalAvg,
    weeksShot: null,
    scores: nullScores15(),
  };
}

function makePriorTeam(shooters: Shooter[]): PriorTeam {
  return {
    id: 't1',
    name: 'Team',
    captain: '',
    shooters,
    totals: { targets: [], rankPoints: [], bonusPoints: [] },
  };
}

// ---------------------------------------------------------------------------
// Block 0: primitive helpers
// ---------------------------------------------------------------------------

describe('mean', () => {
  it('returns 0 for empty array', () => {
    expect(mean([])).toBe(0);
  });

  it('returns the single value for a one-element array', () => {
    expect(mean([42])).toBe(42);
  });

  it('returns arithmetic mean for multiple values', () => {
    expect(mean([10, 20, 30])).toBeCloseTo(20, 10);
  });
});

describe('isDummyName', () => {
  it('returns true for "DUMMY" (uppercase)', () => {
    expect(isDummyName('Smith DUMMY1')).toBe(true);
  });

  it('returns true for mixed-case dummy', () => {
    expect(isDummyName('Smith Dummy2')).toBe(true);
  });

  it('returns false for a real shooter name', () => {
    expect(isDummyName('Alice Smith')).toBe(false);
  });

  it('returns false for a name containing "dummy" as a substring of a word', () => {
    // Sanity: this won't appear in real data, but the rule is substring match.
    expect(isDummyName('McDummy')).toBe(true);
  });
});

describe('normalizeShooterName', () => {
  it('lowercases and trims the name', () => {
    expect(normalizeShooterName('  Alice Smith  ')).toBe('alice smith');
  });

  it('returns already-normalized name unchanged', () => {
    expect(normalizeShooterName('alice smith')).toBe('alice smith');
  });
});

describe('getLastWord', () => {
  it('returns the last word of a multi-word name', () => {
    expect(getLastWord('John Smith')).toBe('Smith');
  });

  it('returns the name itself when there is only one word', () => {
    expect(getLastWord('Smith')).toBe('Smith');
  });

  it('returns last word of a three-word name', () => {
    expect(getLastWord('Mary Jane Watson')).toBe('Watson');
  });

  it('trims surrounding whitespace before splitting', () => {
    expect(getLastWord('  John Smith  ')).toBe('Smith');
  });
});

// ---------------------------------------------------------------------------
// Block 1: computeGoingInAverage
// ---------------------------------------------------------------------------

describe('computeGoingInAverage', () => {
  it('returns startingAvg when weekIndex = 0', () => {
    expect(computeGoingInAverage(35, [40, 42, null, null], 0)).toBe(35);
  });

  it('returns startingAvg when 0 weeks shot (all null)', () => {
    expect(computeGoingInAverage(35, [null, null, null], 3)).toBe(35);
  });

  it('includes startingAvg when exactly 1 week shot (weeksShot < 2)', () => {
    // weekIndex=2: priorScores=[40], weeksShot=1 < 2 → mean(35, 40) = 37.5
    expect(computeGoingInAverage(35, [40, null, null], 2)).toBe(37.5);
  });

  it('phases out startingAvg once 2 weeks are shot', () => {
    // weekIndex=3: priorScores=[40,42], weeksShot=2 ≥ 2 → mean(40,42) = 41
    expect(computeGoingInAverage(35, [40, 42, null], 3)).toBe(41);
  });

  it('returns mean of prior scores when 3+ weeks shot', () => {
    // weekIndex=4: priorScores=[40,42,44], weeksShot=3 → mean = 42
    expect(computeGoingInAverage(35, [40, 42, 44, null], 4)).toBeCloseTo(42, 5);
  });

  it('excludes null values between real scores', () => {
    // weekIndex=4: priorScores=[40, null, 44, null].slice(0,4) → [40,44], weeksShot=2 → mean=42
    expect(computeGoingInAverage(35, [40, null, 44, null], 4)).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Block 2: computeShooterAverage
// ---------------------------------------------------------------------------

describe('computeShooterAverage', () => {
  it('returns startingAvg when throughWeekIndex < 0', () => {
    expect(computeShooterAverage(35, [40, 42], -1)).toBe(35);
  });

  it('returns startingAvg when 0 weeks shot in range', () => {
    expect(computeShooterAverage(35, [null, null, null, null, null], 4)).toBe(35);
  });

  it('includes startingAvg when exactly 1 week shot in range', () => {
    expect(computeShooterAverage(35, [40, null, null, null, null], 4)).toBe(37.5);
  });

  it('returns mean of shots only when 2+ weeks shot in range', () => {
    expect(computeShooterAverage(35, [40, 42, null, null, null], 4)).toBe(41);
  });

  it('limits computation window to throughWeekIndex (inclusive)', () => {
    // twi=1: slice=[40,42], 2 weeks → mean(40,42) = 41 (ignores 44, 46)
    expect(computeShooterAverage(35, [40, 42, 44, 46], 1)).toBe(41);
  });
});

// ---------------------------------------------------------------------------
// Block 3: computeTeamTargets
// ---------------------------------------------------------------------------

describe('computeTeamTargets', () => {
  it('returns 0 when all scores are null for the week', () => {
    const shooters = [
      makeScorecardShooter('A', 35, [null, 40]),
      makeScorecardShooter('B', 35, [null, 38]),
    ];
    expect(computeTeamTargets(shooters, 0)).toBe(0);
  });

  it('sums non-null scores including dummies', () => {
    const shooters = [
      makeScorecardShooter('A', 35, [40, null]),
      makeScorecardShooter('DUMMY 1', 35, [20, null], { isDummy: true }),
      makeScorecardShooter('B', 35, [null, null]),
    ];
    expect(computeTeamTargets(shooters, 0)).toBe(60);
  });

  it('sums dummy scores alone when only dummies shot', () => {
    const shooters = [
      makeScorecardShooter('Real', 35, [null, null]),
      makeScorecardShooter('DUMMY 1', 35, [30, null], { isDummy: true }),
    ];
    expect(computeTeamTargets(shooters, 0)).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Block 3b: computeDummyScore
// ---------------------------------------------------------------------------

describe('computeDummyScore', () => {
  it('returns null when realScores is empty (team had no entry)', () => {
    expect(computeDummyScore([])).toBeNull();
  });

  it('single shooter score 20 → round(20)−5 = 15', () => {
    expect(computeDummyScore([20])).toBe(15);
  });

  it('two shooters 20 and 22 → round(21)−5 = 16', () => {
    expect(computeDummyScore([20, 22])).toBe(16);
  });

  it('rounds mean before subtracting: mean([19,22])=20.5 → round=21 → 16', () => {
    expect(computeDummyScore([19, 22])).toBe(16);
  });

  it('rounds mean before subtracting: mean([18,22])=20 → round=20 → 15', () => {
    expect(computeDummyScore([18, 22])).toBe(15);
  });

  it('floors result at 0 when mean is less than 5', () => {
    // mean([3]) = 3 → 3−5 = −2 → 0
    expect(computeDummyScore([3])).toBe(0);
  });

  it('floors result at 0 when mean equals exactly 5', () => {
    // mean([5]) = 5 → 5−5 = 0
    expect(computeDummyScore([5])).toBe(0);
  });

  it('four shooters with high scores', () => {
    // mean([40,42,38,44]) = 41 → 41−5 = 36
    expect(computeDummyScore([40, 42, 38, 44])).toBe(36);
  });
});

// ---------------------------------------------------------------------------
// Block 4: computeGoingInAverageSum
// ---------------------------------------------------------------------------

describe('computeGoingInAverageSum', () => {
  it('returns 0 when no one shot this week', () => {
    const shooters = [
      makeScorecardShooter('A', 35, [null, 40]),
      makeScorecardShooter('B', 30, [null, 38]),
    ];
    expect(computeGoingInAverageSum(shooters, 0)).toBe(0);
  });

  it('sums real shooters going-in avgs when no dummies', () => {
    // Both at weekIndex=0 → goingInAvg = startingAvg
    const shooters = [
      makeScorecardShooter('A', 35, [40, null]),
      makeScorecardShooter('B', 30, [38, null]),
    ];
    expect(computeGoingInAverageSum(shooters, 0)).toBe(65);
  });

  it('adds dummy going-in avg as mean of real shooters (1 real + 1 dummy)', () => {
    // Real A: goingInAvg=35. Dummy going-in = mean([35]) = 35. Sum = 35+35 = 70.
    // (Dummy.startingAvg=10 is intentionally ignored.)
    const shooters = [
      makeScorecardShooter('A', 35, [40, null]),
      makeScorecardShooter('DUMMY 1', 10, [20, null], { isDummy: true }),
    ];
    expect(computeGoingInAverageSum(shooters, 0)).toBe(70);
  });

  it('adds dummy going-in avg as mean of real shooters (2 real + 1 dummy)', () => {
    // Real A goingIn=35, Real B goingIn=25. dummyGoingIn = mean([35,25]) = 30. Sum = 35+25+30 = 90.
    const shooters = [
      makeScorecardShooter('A', 35, [40, null]),
      makeScorecardShooter('B', 25, [30, null]),
      makeScorecardShooter('DUMMY 1', 10, [20, null], { isDummy: true }),
    ];
    expect(computeGoingInAverageSum(shooters, 0)).toBe(90);
  });

  it('returns 0 when only dummies shot (no real shooters this week)', () => {
    // No real shooters shot → dummyGoingInAvg = 0, dummySum = 0
    const shooters = [
      makeScorecardShooter('Real', 35, [null, 40]),
      makeScorecardShooter('DUMMY 1', 35, [20, null], { isDummy: true }),
    ];
    expect(computeGoingInAverageSum(shooters, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Block 5: computeTargetBonus
// ---------------------------------------------------------------------------

describe('computeTargetBonus', () => {
  it('returns 5 when targets exceed going-in sum', () => {
    expect(computeTargetBonus(80, 65)).toBe(5);
  });

  it('returns null when targets equal going-in sum', () => {
    expect(computeTargetBonus(65, 65)).toBeNull();
  });

  it('returns null when targets are less than going-in sum', () => {
    expect(computeTargetBonus(60, 65)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Block 6: computeRookieBonus
// ---------------------------------------------------------------------------

describe('computeRookieBonus', () => {
  it('returns 0 when weekIndex >= 10 regardless of rookies', () => {
    const shooters = [
      makeScorecardShooter('R', 30, new Array<number | null>(15).fill(40), { rookie: true }),
    ];
    expect(computeRookieBonus(shooters, 10)).toBe(0);
    expect(computeRookieBonus(shooters, 14)).toBe(0);
  });

  it('returns 0 when no rookie shooters on team', () => {
    const shooters = [
      makeScorecardShooter('A', 30, [40]),
      makeScorecardShooter('B', 32, [38]),
    ];
    expect(computeRookieBonus(shooters, 0)).toBe(0);
  });

  it('returns 0 when rookie going-in avg is exactly 35 (not < 35)', () => {
    const shooters = [makeScorecardShooter('R', 35, [40], { rookie: true })];
    expect(computeRookieBonus(shooters, 0)).toBe(0);
  });

  it('returns 1 for a rookie with going-in avg < 35 who shot', () => {
    const shooters = [makeScorecardShooter('R', 30, [40], { rookie: true })];
    expect(computeRookieBonus(shooters, 0)).toBe(1);
  });

  it('returns 2 when two qualifying rookies shot', () => {
    const shooters = [
      makeScorecardShooter('R1', 30, [40], { rookie: true }),
      makeScorecardShooter('R2', 28, [38], { rookie: true }),
    ];
    expect(computeRookieBonus(shooters, 0)).toBe(2);
  });

  it('caps at 2 even with 3 qualifying rookies', () => {
    const shooters = [
      makeScorecardShooter('R1', 30, [40], { rookie: true }),
      makeScorecardShooter('R2', 28, [38], { rookie: true }),
      makeScorecardShooter('R3', 32, [36], { rookie: true }),
    ];
    expect(computeRookieBonus(shooters, 0)).toBe(2);
  });

  it('excludes isDummy shooters from rookie bonus', () => {
    const shooters = [
      makeScorecardShooter('DUMMY R', 30, [40], { rookie: true, isDummy: true }),
    ];
    expect(computeRookieBonus(shooters, 0)).toBe(0);
  });

  it('returns 0 when rookie did not shoot this week', () => {
    const shooters = [makeScorecardShooter('R', 30, [null, 40], { rookie: true })];
    expect(computeRookieBonus(shooters, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Block 7: computeRankPoints
// ---------------------------------------------------------------------------

describe('computeRankPoints', () => {
  it('returns empty array for empty input', () => {
    expect(computeRankPoints([])).toEqual([]);
  });

  it('returns all-null for all-null input', () => {
    expect(computeRankPoints([null, null])).toEqual([null, null]);
  });

  it('assigns clean rank points for 3 teams (30, 28, 26)', () => {
    expect(computeRankPoints([200, 180, 160])).toEqual([30, 28, 26]);
  });

  it('splits 2-way tie for rank 1 → mean(30,28) = 29', () => {
    expect(computeRankPoints([200, 200, 160])).toEqual([29, 29, 26]);
  });

  it('splits 3-way tie for rank 1 → mean(30,28,26) = 28', () => {
    expect(computeRankPoints([200, 200, 200])).toEqual([28, 28, 28]);
  });

  it('splits tie for ranks 6+7 in an 8-team field', () => {
    // Ranks 6+7 share 100 targets: mean(20,18) = 19; rank 8 = 16
    expect(computeRankPoints([200, 180, 160, 140, 120, 100, 100, 80]))
      .toEqual([30, 28, 26, 24, 22, 19, 19, 16]);
  });

  it('assigns null to teams with null targets while ranking the rest', () => {
    // Only 2 participants (null excluded), so rank 1=30 and rank 2=28 among participants
    expect(computeRankPoints([200, null, 160])).toEqual([30, null, 28]);
  });

  it('treats forfeit (0 targets) as last place', () => {
    expect(computeRankPoints([200, 0])).toEqual([30, 28]);
  });
});

// ---------------------------------------------------------------------------
// Block 8: computeShooterStartingAvg
// ---------------------------------------------------------------------------

describe('computeShooterStartingAvg', () => {
  it('returns prior-year finalAvg when shooter is found', () => {
    const teams = [makePriorTeam([makePriorShooter('Alice', 42)])];
    expect(computeShooterStartingAvg('Alice', teams)).toBe(42);
  });

  it('returns 35 when shooter is not found in any prior team', () => {
    const teams = [makePriorTeam([makePriorShooter('Bob', 40)])];
    expect(computeShooterStartingAvg('Alice', teams)).toBe(35);
  });

  it('matches shooter names case-insensitively', () => {
    const teams = [makePriorTeam([makePriorShooter('alice smith', 42)])];
    expect(computeShooterStartingAvg('Alice Smith', teams)).toBe(42);
  });

  it('returns 35 when shooter found but finalAvg is null', () => {
    const teams = [makePriorTeam([makePriorShooter('Alice', null)])];
    expect(computeShooterStartingAvg('Alice', teams)).toBe(35);
  });

  it('finds shooter on second team when not on first', () => {
    const teams = [
      makePriorTeam([makePriorShooter('Bob', 40)]),
      makePriorTeam([makePriorShooter('Alice', 44)]),
    ];
    expect(computeShooterStartingAvg('Alice', teams)).toBe(44);
  });
});

// ---------------------------------------------------------------------------
// Block 9: isShooterRookie
// ---------------------------------------------------------------------------

describe('isShooterRookie', () => {
  it('returns true when not found in prior1 or prior2', () => {
    expect(isShooterRookie('NewGuy', [], [])).toBe(true);
  });

  it('returns false when found in prior1', () => {
    const prior1 = [makePriorTeam([makePriorShooter('Alice', 40)])];
    expect(isShooterRookie('Alice', prior1, [])).toBe(false);
  });

  it('returns false when found in prior2', () => {
    const prior2 = [makePriorTeam([makePriorShooter('Alice', 40)])];
    expect(isShooterRookie('Alice', [], prior2)).toBe(false);
  });

  it('returns false when found in both years', () => {
    const prior1 = [makePriorTeam([makePriorShooter('Alice', 40)])];
    const prior2 = [makePriorTeam([makePriorShooter('Alice', 38)])];
    expect(isShooterRookie('Alice', prior1, prior2)).toBe(false);
  });

  it('matches shooter names case-insensitively', () => {
    const prior1 = [makePriorTeam([makePriorShooter('alice smith', 40)])];
    expect(isShooterRookie('Alice Smith', prior1, [])).toBe(false);
  });

  it('returns true with empty prior years', () => {
    expect(isShooterRookie('Anyone', [], [])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Block 10: computeMostImprovedScore
// ---------------------------------------------------------------------------

describe('computeMostImprovedScore', () => {
  it('returns 0 when startingAvg equals finalAvg', () => {
    expect(computeMostImprovedScore(35, 35)).toBe(0);
  });

  it('computes improvement for startingAvg=35 → finalAvg=40', () => {
    // 100 * (40-35) / (50-35) = 100 * 5/15 ≈ 33.333
    expect(computeMostImprovedScore(35, 40)).toBeCloseTo(33.333, 2);
  });

  it('computes improvement for startingAvg=20 → finalAvg=40', () => {
    // 100 * (40-20) / (50-20) = 100 * 20/30 ≈ 66.667
    expect(computeMostImprovedScore(20, 40)).toBeCloseTo(66.667, 2);
  });

  it('computes improvement for startingAvg=30 → finalAvg=45', () => {
    // 100 * (45-30) / (50-30) = 100 * 15/20 = 75
    expect(computeMostImprovedScore(30, 45)).toBe(75);
  });
});

// ---------------------------------------------------------------------------
// Block 11: computeSeasonAwards
// ---------------------------------------------------------------------------

describe('computeSeasonAwards', () => {
  const makeTeam = (name: string, shooters: ScorecardShooter[]): ScTeam => ({
    name,
    shooters,
    totals: makeEmptyTotals(),
  });

  const makeSeasonData = (teams: ScTeam[]): SeasonData => ({ season: 2024, teams });

  it('returns all null when no shooters have >= 6 weeks shot', () => {
    const scores = nScores(5, 40); // 5 < 6 weeks
    const data = makeSeasonData([
      makeTeam('Team A', [makeScorecardShooter('Alice', 35, scores)]),
    ]);
    const awards = computeSeasonAwards(data);
    expect(awards.highestAvgShooter).toBeNull();
    expect(awards.rookieOfYear).toBeNull();
    expect(awards.mostImproved).toBeNull();
  });

  it('returns all null when all eligible shooters are dummies', () => {
    const data = makeSeasonData([
      makeTeam('Team A', [
        makeScorecardShooter('DUMMY 1', 35, nScores(6, 40), { isDummy: true }),
      ]),
    ]);
    expect(computeSeasonAwards(data).highestAvgShooter).toBeNull();
  });

  it('identifies single eligible non-rookie as highestAvgShooter; rookieOfYear is null', () => {
    const data = makeSeasonData([
      makeTeam('Team A', [makeScorecardShooter('Bob', 35, nScores(6, 40))]),
    ]);
    const awards = computeSeasonAwards(data);
    expect(awards.highestAvgShooter).toBe('Bob');
    expect(awards.highestAvg).toBe(40);
    expect(awards.rookieOfYear).toBeNull();
  });

  it('single eligible rookie wins both highestAvg and rookieOfYear', () => {
    const data = makeSeasonData([
      makeTeam('Team A', [
        makeScorecardShooter('Rex', 35, nScores(6, 40), { rookie: true }),
      ]),
    ]);
    const awards = computeSeasonAwards(data);
    expect(awards.highestAvgShooter).toBe('Rex');
    expect(awards.rookieOfYear).toBe('Rex');
  });

  it('identifies most improved shooter with formatted percentage', () => {
    // X: startingAvg=35 → finalAvg=40  → 100*5/15  ≈ 33.33%
    // Y: startingAvg=20 → finalAvg=40  → 100*20/30 ≈ 66.67% (wins)
    const data = makeSeasonData([
      makeTeam('Team A', [
        makeScorecardShooter('X', 35, nScores(6, 40)),
        makeScorecardShooter('Y', 20, nScores(6, 40)),
      ]),
    ]);
    const awards = computeSeasonAwards(data);
    expect(awards.mostImproved).toBe('Y');
    expect(awards.improvement).toBe('66.67%');
  });
});

// ---------------------------------------------------------------------------
// Block 12: computeSeasonTotals (integration)
// ---------------------------------------------------------------------------

describe('computeSeasonTotals', () => {
  /**
   * Fixture — 2 teams, 15 weeks:
   *
   * Team 1: Alice (startingAvg=40) + DUMMY 1 (startingAvg=10, intentionally low)
   *   W1 (wi=0): Alice=40, Dummy=40  →  targets=80
   *   W2 (wi=1): Alice=42, Dummy=null →  targets=42
   *
   * Team 2: Charlie (startingAvg=40) + Dana (startingAvg=40)
   *   W1 (wi=0): Charlie=40, Dana=40  → targets=80
   *   W2 (wi=1): null, null           → no-show
   *
   * Expected W1:
   *   Team1 goingInSum = 40 (Alice, wi=0) + mean([40])*1 (dummy) = 80 → 80 not > 80 → bonusPoints=null
   *   Team2 goingInSum = 40+40 = 80 → null
   *   Tie at 80: rankPoints = mean(30,28) = 29 each
   *
   * Expected W2:
   *   Team1: goingInAvg(Alice, wi=1) = mean(40,40)=40; targets=42 > 40 → bonusPoints=5; rank 1 = 30
   *   Team2: no-show → targets=null, bonusPoints=null, rankPoints=28 (scored 0)
   *
   * The dummy's startingAvg=10 is the canary: if the dummy's own startingAvg were
   * used for W1, goingInSum would be 40+10=50 and 80>50 would flip bonusPoints to 5.
   */
  function buildSeasonData(): SeasonData {
    const aliceScores: (number | null)[] = [40, 42, ...new Array<number | null>(13).fill(null)];
    const dummyScores: (number | null)[] = [40, ...new Array<number | null>(14).fill(null)];
    const charlieScores: (number | null)[] = [40, ...new Array<number | null>(14).fill(null)];
    const danaScores: (number | null)[] = [40, ...new Array<number | null>(14).fill(null)];

    return {
      season: 2024,
      teams: [
        {
          name: 'Team 1',
          shooters: [
            makeScorecardShooter('Alice', 40, aliceScores),
            makeScorecardShooter('DUMMY 1', 10, dummyScores, { isDummy: true }),
          ],
          totals: makeEmptyTotals(),
        },
        {
          name: 'Team 2',
          shooters: [
            makeScorecardShooter('Charlie', 40, charlieScores),
            makeScorecardShooter('Dana', 40, danaScores),
          ],
          totals: makeEmptyTotals(),
        },
      ],
    };
  }

  it('computes team targets correctly for both teams in W1', () => {
    const result = computeSeasonTotals(buildSeasonData());
    expect(result.teams[0]!.totals.targets[0]).toBe(80); // Team 1 W1
    expect(result.teams[1]!.totals.targets[0]).toBe(80); // Team 2 W1
  });

  it('records null targets for no-show team in W2', () => {
    const result = computeSeasonTotals(buildSeasonData());
    expect(result.teams[0]!.totals.targets[1]).toBe(42);   // Team 1 W2
    expect(result.teams[1]!.totals.targets[1]).toBeNull(); // Team 2 W2 no-show
  });

  it('splits tied rank points correctly (W1 both at 80 → 29 each)', () => {
    const result = computeSeasonTotals(buildSeasonData());
    expect(result.teams[0]!.totals.rankPoints[0]).toBe(29);
    expect(result.teams[1]!.totals.rankPoints[0]).toBe(29);
  });

  it('assigns rank points to no-show team in W2 (0 targets → rank 2 = 28)', () => {
    const result = computeSeasonTotals(buildSeasonData());
    expect(result.teams[0]!.totals.rankPoints[1]).toBe(30); // rank 1
    expect(result.teams[1]!.totals.rankPoints[1]).toBe(28); // rank 2 (no-show → 0 targets)
  });

  it('computes bonus points correctly for each team and week', () => {
    const result = computeSeasonTotals(buildSeasonData());
    expect(result.teams[0]!.totals.bonusPoints[0]).toBeNull(); // 80 not > 80
    expect(result.teams[0]!.totals.bonusPoints[1]).toBe(5);    // 42 > 40 → target bonus
    expect(result.teams[1]!.totals.bonusPoints[0]).toBeNull(); // 80 not > 80
    expect(result.teams[1]!.totals.bonusPoints[1]).toBeNull(); // no-show
  });

  it('uses mean of real shooter going-in avgs for dummy (dummy.startingAvg=10 ignored)', () => {
    // If dummy's own startingAvg=10 were used: goingInSum = 40+10 = 50 → 80>50 → bonus=5 (wrong).
    // Correct: dummyGoingIn = mean([40]) = 40 → goingInSum=80 → 80 not > 80 → null.
    const result = computeSeasonTotals(buildSeasonData());
    expect(result.teams[0]!.totals.bonusPoints[0]).toBeNull();
  });

  it('does not mutate the input SeasonData', () => {
    const seasonData = buildSeasonData();
    const originalTargets0 = [...seasonData.teams[0]!.totals.targets];
    const originalTargets1 = [...seasonData.teams[1]!.totals.targets];
    computeSeasonTotals(seasonData);
    expect(seasonData.teams[0]!.totals.targets).toEqual(originalTargets0);
    expect(seasonData.teams[1]!.totals.targets).toEqual(originalTargets1);
  });
});

describe('sortShootersWithCaptainFirst', () => {
  it('moves captain to index 0', () => {
    const shooters = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }];
    const result = sortShootersWithCaptainFirst(shooters, 'Bob');
    expect(result[0]?.name).toBe('Bob');
    expect(result[1]?.name).toBe('Alice');
    expect(result[2]?.name).toBe('Charlie');
  });

  it('is a no-op when captain is already first', () => {
    const shooters = [{ name: 'Bob' }, { name: 'Alice' }];
    const result = sortShootersWithCaptainFirst(shooters, 'Bob');
    expect(result[0]?.name).toBe('Bob');
    expect(result[1]?.name).toBe('Alice');
  });

  it('is case-insensitive (delegates to normalizeShooterName)', () => {
    const shooters = [{ name: 'alice' }, { name: 'BOB' }];
    const result = sortShootersWithCaptainFirst(shooters, 'bob');
    expect(result[0]?.name).toBe('BOB');
  });

  it('preserves original order when captain is not found', () => {
    const shooters = [{ name: 'Alice' }, { name: 'Bob' }];
    const result = sortShootersWithCaptainFirst(shooters, 'Charlie');
    expect(result[0]?.name).toBe('Alice');
    expect(result[1]?.name).toBe('Bob');
  });

  it('does not mutate the input array', () => {
    const shooters = [{ name: 'Alice' }, { name: 'Bob' }];
    sortShootersWithCaptainFirst(shooters, 'Bob');
    expect(shooters[0]?.name).toBe('Alice');
  });
});
