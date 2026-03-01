/**
 * Scoring Engine — Pure Computation Service
 *
 * All functions are pure: no I/O, no side effects, no framework dependencies.
 * Processes the CITL trap league business rules for averages, bonuses, rank
 * points, and season awards.
 *
 * Architecture: this file may only import from types/. Never import from
 * repositories, services, or views.
 */

import type { ScorecardShooter, SeasonData } from '@/types/scorecard';
import type { ComputedAwards } from '@/types/season';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ---------------------------------------------------------------------------
// Average computation
// ---------------------------------------------------------------------------

/**
 * Compute a shooter's current average BEFORE a given week is factored in.
 * This is the "going-in average" used for bonus points and rank points calculations.
 *
 * Rule: if fewer than 2 weeks have been shot (through weekIndex-1), include
 * the starting average in the mean. Once ≥ 2 weeks are shot, phase it out.
 */
export function computeGoingInAverage(startingAvg: number, scores: (number | null)[], weekIndex: number): number {
  if (weekIndex === 0) return startingAvg;

  const priorScores = scores.slice(0, weekIndex).filter((s): s is number => s !== null);
  const weeksShot = priorScores.length;

  if (weeksShot === 0) return startingAvg;
  if (weeksShot < 2) return mean([startingAvg, ...priorScores]);
  return mean(priorScores);
}

/**
 * Compute a shooter's current average THROUGH a given week (inclusive).
 * Used for final average calculation and standings display.
 */
export function computeShooterAverage(startingAvg: number, scores: (number | null)[], throughWeekIndex: number): number {
  if (throughWeekIndex < 0) return startingAvg;

  const throughScores = scores.slice(0, throughWeekIndex + 1).filter((s): s is number => s !== null);
  const weeksShot = throughScores.length;

  if (weeksShot === 0) return startingAvg;
  if (weeksShot < 2) return mean([startingAvg, ...throughScores]);
  return mean(throughScores);
}

// ---------------------------------------------------------------------------
// Team weekly calculations
// ---------------------------------------------------------------------------

/**
 * Sum of all non-null scores (real + dummy) for a team on a given week.
 */
export function computeTeamTargets(shooters: ScorecardShooter[], weekIndex: number): number {
  return shooters.reduce((sum, s) => {
    const score = s.scores[weekIndex];
    return score != null ? sum + score : sum;
  }, 0);
}

/**
 * Compute the going-in average sum for the bonus points calculation.
 *
 * For real shooters who shot this week: their individual going-in average.
 * For dummies who shot this week: dummy going-in avg = mean of real shooters'
 *   going-in avgs this week (computed first, so no circular dependency).
 * Only includes shooters who actually shot this week (non-null score).
 */
export function computeGoingInAverageSum(shooters: ScorecardShooter[], weekIndex: number): number {
  const realShootersWhoShot = shooters.filter(
    (s) => !s.isDummy && s.scores[weekIndex] != null,
  );
  const dummiesWhoShot = shooters.filter(
    (s) => s.isDummy && s.scores[weekIndex] != null,
  );

  const realGoingInAvgs = realShootersWhoShot.map((s) =>
    computeGoingInAverage(s.startingAvg, s.scores, weekIndex),
  );

  const dummyGoingInAvg = realGoingInAvgs.length > 0 ? mean(realGoingInAvgs) : 0;

  const realSum = realGoingInAvgs.reduce((a, b) => a + b, 0);
  const dummySum = dummiesWhoShot.length * dummyGoingInAvg;

  return realSum + dummySum;
}

/**
 * Compute the target component of bonus points: +5 if team targets exceed the going-in sum.
 */
export function computeTargetBonus(teamTargets: number, goingInSum: number): 5 | null {
  return teamTargets > goingInSum ? 5 : null;
}

/**
 * Award +1 point per rookie whose going-in avg < 35 AND who shot this week;
 * maximum 2 points. Not awarded for weekIndex >= 10 (W11–W15).
 * Dummies excluded.
 */
export function computeRookieBonus(shooters: ScorecardShooter[], weekIndex: number): number {
  if (weekIndex >= 10) return 0;

  let bonus = 0;
  for (const shooter of shooters) {
    if (shooter.isDummy || !shooter.rookie) continue;
    if (shooter.scores[weekIndex] == null) continue;

    const goingInAvg = computeGoingInAverage(shooter.startingAvg, shooter.scores, weekIndex);
    if (goingInAvg < 35) {
      bonus += 1;
      if (bonus >= 2) break;
    }
  }
  return bonus;
}

// ---------------------------------------------------------------------------
// Cross-team rank points (one week)
// ---------------------------------------------------------------------------

/**
 * Given an array of team targets for one week, return rank points per team.
 *
 * Scale: Rank 1 = 30, Rank 2 = 28, … (−2 per rank).
 * Ties: all tied teams receive the mean of the points they would have shared.
 * Teams with null targets are excluded from ranking and receive null.
 */
export function computeRankPoints(allTeamTargets: (number | null)[]): (number | null)[] {
  const n = allTeamTargets.length;
  const result: (number | null)[] = new Array(n).fill(null);

  const participants = allTeamTargets
    .map((targets, i) => ({ targets, i }))
    .filter((x): x is { targets: number; i: number } => x.targets !== null);

  if (participants.length === 0) return result;

  participants.sort((a, b) => b.targets - a.targets);

  let pos = 0;
  while (pos < participants.length) {
    const currentTargets = participants[pos]!.targets;

    let tieEnd = pos + 1;
    while (tieEnd < participants.length && participants[tieEnd]!.targets === currentTargets) {
      tieEnd++;
    }
    const tieCount = tieEnd - pos;

    let pointsSum = 0;
    for (let r = pos; r < tieEnd; r++) {
      pointsSum += 30 - r * 2;
    }
    const tiePoints = pointsSum / tieCount;

    for (let r = pos; r < tieEnd; r++) {
      result[participants[r]!.i] = tiePoints;
    }

    pos = tieEnd;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Full season pass
// ---------------------------------------------------------------------------

/**
 * Compute all weekly totals (targets, rankPoints, bonusPoints) for a season.
 * Processes weeks sequentially W1→W15 because going-in averages depend on
 * prior weeks. Does NOT mutate input; returns a new SeasonData object.
 */
export function computeSeasonTotals(seasonData: SeasonData): SeasonData {
  const WEEK_COUNT = 15;
  const teams = seasonData.teams;

  const teamTotals = teams.map(() => ({
    targets:     new Array<number | null>(WEEK_COUNT).fill(null),
    rankPoints:  new Array<number | null>(WEEK_COUNT).fill(null),
    bonusPoints: new Array<number | null>(WEEK_COUNT).fill(null),
  }));

  for (let wi = 0; wi < WEEK_COUNT; wi++) {
    const weekTargets: number[] = [];

    for (let ti = 0; ti < teams.length; ti++) {
      const { shooters } = teams[ti]!;
      const totals = teamTotals[ti]!;

      const targets = computeTeamTargets(shooters, wi);
      const goingInSum = computeGoingInAverageSum(shooters, wi);
      const targetBonus = computeTargetBonus(targets, goingInSum);
      const rookieBonus = computeRookieBonus(shooters, wi);
      const totalBonus = (targetBonus === null && rookieBonus === 0)
        ? null
        : (targetBonus ?? 0) + rookieBonus;

      const anyoneShot = shooters.some((s) => s.scores[wi] != null);
      const storedTargets = anyoneShot ? targets : null;

      totals.targets[wi] = storedTargets;
      totals.bonusPoints[wi] = totalBonus;

      weekTargets.push(anyoneShot ? targets : 0);
    }

    const rankPoints = computeRankPoints(weekTargets);
    for (let ti = 0; ti < teams.length; ti++) {
      teamTotals[ti]!.rankPoints[wi] = rankPoints[ti] ?? null;
    }
  }

  return {
    season: seasonData.season,
    teams: teams.map((team, ti) => ({
      ...team,
      totals: teamTotals[ti]!,
    })),
  };
}

// ---------------------------------------------------------------------------
// Season awards
// ---------------------------------------------------------------------------

/**
 * Compute the Most Improved percentage score.
 * Formula: 100 × (finalAvg − startingAvg) / (50 − startingAvg)
 */
export function computeMostImprovedScore(startingAvg: number, finalAvg: number): number {
  return (100 * (finalAvg - startingAvg)) / (50 - startingAvg);
}

/**
 * Compute season awards from final shooter averages.
 * Excludes dummy shooters. Requires weeksShot >= 6.
 */
export function computeSeasonAwards(seasonData: SeasonData): ComputedAwards {
  const WEEK_COUNT = 15;
  const MIN_WEEKS = 6;

  const eligible: {
    name: string;
    teamName: string;
    finalAvg: number;
    startingAvg: number;
    rookie: boolean;
    weeksShot: number;
  }[] = [];

  for (const team of seasonData.teams) {
    for (const shooter of team.shooters) {
      if (shooter.isDummy) continue;

      const weeksShot = shooter.scores.filter((s) => s !== null).length;
      if (weeksShot < MIN_WEEKS) continue;

      const finalAvg = computeShooterAverage(shooter.startingAvg, shooter.scores, WEEK_COUNT - 1);
      eligible.push({
        name: shooter.name,
        teamName: team.name,
        finalAvg,
        startingAvg: shooter.startingAvg,
        rookie: shooter.rookie,
        weeksShot,
      });
    }
  }

  if (eligible.length === 0) {
    return {
      firstPlaceTeam: null,
      firstPlacePoints: null,
      secondPlaceTeam: null,
      secondPlacePoints: null,
      highestAvgShooter: null,
      highestAvg: null,
      rookieOfYear: null,
      rookieAvg: null,
      mostImproved: null,
      improvement: null,
    };
  }

  const topShooter = eligible.reduce((best, s) => s.finalAvg > best.finalAvg ? s : best);

  const rookies = eligible.filter((s) => s.rookie);
  const topRookie = rookies.length > 0
    ? rookies.reduce((best, s) => s.finalAvg > best.finalAvg ? s : best)
    : null;

  const topImproved = eligible.reduce((best, s) => {
    const score = computeMostImprovedScore(s.startingAvg, s.finalAvg);
    const bestScore = computeMostImprovedScore(best.startingAvg, best.finalAvg);
    return score > bestScore ? s : best;
  });
  const improvementScore = computeMostImprovedScore(topImproved.startingAvg, topImproved.finalAvg);
  const improvementPct = `${improvementScore.toFixed(2)}%`;

  return {
    firstPlaceTeam: null,
    firstPlacePoints: null,
    secondPlaceTeam: null,
    secondPlacePoints: null,
    highestAvgShooter: topShooter.name,
    highestAvg: topShooter.finalAvg,
    rookieOfYear: topRookie ? topRookie.name : null,
    rookieAvg: topRookie ? topRookie.finalAvg : null,
    mostImproved: topImproved.name,
    improvement: improvementPct,
  };
}
