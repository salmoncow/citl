import { describe, it, expect } from 'vitest';
import {
  AWARD_MIN_NIGHTS,
  computeAwardRaces,
  computeCurrentAverages,
  computeLeagueAverageByWeek,
  countStraights,
} from './season-highlights';
import type { ShooterScore, WeekResult } from '@/types/score';
import type { AwardShooterInput } from '@/types/season';

const N = null;

function shooter(
  name: string,
  scores: (number | null)[],
  opts: Partial<AwardShooterInput> = {},
): AwardShooterInput {
  return { name, teamName: 'Eagles', isDummy: false, rookie: false, startingAvg: 40, scores, ...opts };
}

describe('computeAwardRaces', () => {
  const shooters = [
    shooter('Ace', [48, 47, 49, 46, 47, 50], { startingAvg: 47 }),
    shooter('Bea', [44, 45, 46, N, N, N], { startingAvg: 44 }),
    shooter('Cal', [30, 32, 35, 38, 40, 42], { rookie: true, startingAvg: 30 }),
    shooter('Dee', [49, N, N, N, N, N]), // one night — below the race threshold
    shooter('Team DUMMY1', [50, 50, 50, 50, 50, 50], { isDummy: true }),
  ];

  it('ranks Top Gun by current average, excluding dummies and one-night shooters', () => {
    const { topGun } = computeAwardRaces(shooters);
    expect(topGun.map((e) => e.name)).toEqual(['Ace', 'Bea', 'Cal']);
    expect(topGun[0]!.value).toBeCloseTo(47.833, 3);
  });

  it('flags award eligibility at the 6-night minimum', () => {
    const { topGun } = computeAwardRaces(shooters);
    expect(AWARD_MIN_NIGHTS).toBe(6);
    expect(topGun.find((e) => e.name === 'Ace')!.eligible).toBe(true);
    expect(topGun.find((e) => e.name === 'Bea')!.eligible).toBe(false);
    expect(topGun.find((e) => e.name === 'Bea')!.nights).toBe(3);
  });

  it('limits the rookie race to rookies', () => {
    expect(computeAwardRaces(shooters).rookie.map((e) => e.name)).toEqual(['Cal']);
  });

  it('ranks Most Improved by the official improvement score', () => {
    const { mostImproved } = computeAwardRaces(shooters);
    // Cal: avg 36.17 from 30 → 100 × 6.17 / 20 ≈ 30.8 — the largest gain
    expect(mostImproved[0]!.name).toBe('Cal');
    expect(mostImproved[0]!.value).toBeCloseTo(30.83, 1);
  });

  it('honours the limit', () => {
    expect(computeAwardRaces(shooters, 1).topGun).toHaveLength(1);
  });
});

function score(name: string, score1: number | null, score2: number | null): ShooterScore {
  return { name, score1, score2, total: (score1 ?? 0) + (score2 ?? 0) };
}

function week(weekNumber: number, scores: ShooterScore[]): WeekResult {
  return {
    weekNumber,
    publishedAt: '',
    teamResults: [{ teamId: 't', teamName: 'T', targets: 0, rankPoints: 0, bonusPoints: 0, shooterScores: scores }],
  };
}

describe('computeLeagueAverageByWeek', () => {
  it('averages non-dummy totals per week in week order', () => {
    const weeks = [
      week(2, [score('A', 20, 20), score('B', 25, 25)]),
      week(1, [score('A', 22, 22), score('T DUMMY1', 10, 10), score('C', 21, 25)]),
    ];
    expect(computeLeagueAverageByWeek(weeks)).toEqual([
      { weekNumber: 1, average: 45 },
      { weekNumber: 2, average: 45 },
    ]);
  });

  it('counts historical rows that carry only a total', () => {
    const hist: ShooterScore = { name: 'H', score1: N, score2: N, total: 41 };
    expect(computeLeagueAverageByWeek([week(1, [hist])])).toEqual([{ weekNumber: 1, average: 41 }]);
  });

  it('omits weeks with no qualifying rows', () => {
    expect(computeLeagueAverageByWeek([week(1, [score('T DUMMY1', 20, 20)])])).toEqual([]);
  });
});

describe('computeCurrentAverages', () => {
  it('ranks shooters with 2+ nights by the mean of their totals', () => {
    const weeks = [
      week(1, [score('A', 22, 22), score('B', 25, 25), score('C', 20, 20)]),
      week(2, [score('A', 24, 24), score('B', 20, 20), score('T DUMMY1', 25, 25)]),
    ];
    // C has one night (starting average still blended) and the dummy is excluded
    expect(computeCurrentAverages(weeks)).toEqual([
      { name: 'A', teamName: 'T', average: 46, nights: 2 },
      { name: 'B', teamName: 'T', average: 45, nights: 2 },
    ]);
  });
});

describe('countStraights', () => {
  it('counts every perfect bunker, two per straight 50', () => {
    const weeks = [
      week(1, [score('A', 25, 25), score('B', 25, 20)]),
      week(2, [score('C', 19, 25), score('T DUMMY1', 25, 25)]),
    ];
    expect(countStraights(weeks)).toEqual({ straight25s: 4, straight50s: 1 });
  });
});
