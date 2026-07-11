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
import type { Team, TeamResult, WeekResult } from '@/types/score';
import type { Accolade } from '@/types/shooter';

// ---------------------------------------------------------------------------
// Primitive helpers — exported for reuse across service and component layers
// ---------------------------------------------------------------------------

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** True if the shooter name represents a dummy/substitute slot. */
export function isDummyName(name: string): boolean {
  return name.toUpperCase().includes('DUMMY');
}

/** Canonical key for case-insensitive name comparisons. */
export function normalizeShooterName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Last word of a name (typically the surname), used to prefix dummy names.
 * Returns the full name when it contains no spaces.
 */
export function getLastWord(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

/**
 * Returns a shallow copy of `shooters` with the captain moved to index 0.
 * All other elements keep their original relative order.
 * Comparison is case-insensitive via normalizeShooterName.
 * No-op if captain is already first or not found.
 */
export function sortShootersWithCaptainFirst<T extends { name: string }>(
  shooters: T[],
  captainName: string,
): T[] {
  if (!captainName) return [...shooters];
  const cap = normalizeShooterName(captainName);
  const idx = shooters.findIndex((s) => normalizeShooterName(s.name) === cap);
  if (idx <= 0) return [...shooters];
  const result = [...shooters];
  const [captain] = result.splice(idx, 1);
  result.unshift(captain!);
  return result;
}

// ---------------------------------------------------------------------------
// Accolades
// ---------------------------------------------------------------------------

/**
 * Compute Straight-25 and Straight-50 accolades for a published week.
 * - Straight 50: score1 === 25 AND score2 === 25
 * - Straight 25: score1 === 25 XOR score2 === 25
 * Dummy shooters and entries with null scores (historical) are skipped.
 * Straight 50 takes precedence — a shooter is not listed twice.
 * Results are ordered: 50s first, then 25s; alphabetical by name within each tier.
 */
export function computeAccolades(teamResults: TeamResult[]): Accolade[] {
  const straight50: Accolade[] = [];
  const straight25: Accolade[] = [];

  for (const tr of teamResults) {
    for (const s of tr.shooterScores) {
      if (isDummyName(s.name)) continue;
      if (s.score1 === null && s.score2 === null) continue;
      if (s.score1 === 25 && s.score2 === 25) {
        straight50.push({ shooterName: s.name, teamName: tr.teamName, streak: 50 });
      } else if (s.score1 === 25 || s.score2 === 25) {
        straight25.push({ shooterName: s.name, teamName: tr.teamName, streak: 25 });
      }
    }
  }

  const byName = (a: Accolade, b: Accolade) =>
    a.shooterName.localeCompare(b.shooterName);

  return [...straight50.sort(byName), ...straight25.sort(byName)];
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

/**
 * Build a name→finalAvg map from published WeekResult documents. The final
 * number is delegated to computeShooterAverage so the <2-weeks starting-avg
 * blend rule has exactly one implementation (deep-review F-02).
 *
 * Deliberate adaptations for the prior-season context (kept from the original
 * score-service implementation so outputs are unchanged):
 * - startingAvg <= 0 is treated as corrupt data and coerced to 35;
 * - accumulation is keyed by normalized shooter NAME across teams (a shooter
 *   who subbed on two teams gets one combined average);
 * - shooters absent from priorTeams fall back to startingAvg 35;
 * - dummy shooters are NOT filtered — dummy names are team-scoped
 *   ("<team> DUMMY1") and only resolve against rosters that contain them,
 *   matching the pre-refactor behavior;
 * - the result is rounded to one decimal (display convention).
 */
export function buildPriorAvgMap(weekResults: WeekResult[], priorTeams: Team[]): Map<string, number> {
  // startingAvg lookup keyed by normalized name (first match wins)
  const startingAvgMap = new Map<string, number>();
  for (const team of priorTeams) {
    for (const shooter of team.shooters) {
      const key = normalizeShooterName(shooter.name);
      if (!startingAvgMap.has(key)) {
        startingAvgMap.set(key, shooter.startingAvg > 0 ? shooter.startingAvg : 35);
      }
    }
  }

  // Collect each shooter's actual scores across all published weeks.
  const scoresByShooter = new Map<string, number[]>();
  for (const wr of weekResults) {
    for (const tr of wr.teamResults ?? []) {
      for (const s of tr.shooterScores ?? []) {
        if (typeof s.total !== 'number' || !isFinite(s.total)) continue;
        const key = normalizeShooterName(s.name);
        const list = scoresByShooter.get(key) ?? [];
        list.push(s.total);
        scoresByShooter.set(key, list);
      }
    }
  }

  const result = new Map<string, number>();
  for (const [key, scores] of scoresByShooter) {
    const startingAvg = startingAvgMap.get(key) ?? 35;
    const avg = computeShooterAverage(startingAvg, scores, scores.length - 1);
    result.set(key, parseFloat(avg.toFixed(1)));
  }
  return result;
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
 * Compute the dummy (substitute) score for an absent shooter.
 * Rule: mean of real shooters' actual scores that night, minus 5, floored at 0.
 * Returns null when no real-shooter scores are provided (team had no entry that week).
 */
export function computeDummyScore(realScores: number[]): number | null {
  if (realScores.length === 0) return null;
  return Math.max(0, Math.round(mean(realScores)) - 5);
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
// Standings ordering
// ---------------------------------------------------------------------------

/**
 * Standings sort comparator: total points (rankPoints + bonusPoints) descending,
 * then total targets descending as the tie-breaker — a points tie is broken in
 * favor of the team that broke more targets. Equal on both points and targets
 * returns 0; Array.prototype.sort is stable, so the existing order is preserved.
 */
export function compareStandings(
  a: { points: number; targets: number },
  b: { points: number; targets: number },
): number {
  if (b.points !== a.points) return b.points - a.points;
  return b.targets - a.targets;
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
/**
 * Compute the starting average for a shooter entering a new season.
 * If found in any prior-year team with a non-null finalAvg, returns that value.
 * Otherwise returns 35 (new-shooter default).
 * Name matching is case-insensitive and trimmed. Pure — no I/O.
 */
export function computeShooterStartingAvg(
  shooterName: string,
  priorYearTeams: Team[],
): number {
  const key = normalizeShooterName(shooterName);
  for (const team of priorYearTeams) {
    for (const shooter of team.shooters) {
      if (normalizeShooterName(shooter.name) === key && shooter.finalAvg !== null && shooter.finalAvg > 0) {
        return shooter.finalAvg;
      }
    }
  }
  return 35;
}

/**
 * Determine if a shooter is a rookie for the upcoming season.
 * Business rule: a shooter who has been a member of a team but has not shot
 * for 2 consecutive years is considered a Rookie.
 *
 * "Shot" is determined by:
 *   1. Presence in a published avg map (derived from WeekResult documents) — primary
 *   2. A positive finalAvg in the team document — fallback for historical seasons
 *      where weeks were not published via the admin panel
 *
 * Pass prior1AvgMap / prior2AvgMap (from buildPriorAvgMap) so that roster-only
 * members who never shot are correctly identified as rookies even when they
 * appear in both prior-year team documents.
 *
 * Pure — no I/O.
 */
export function isShooterRookie(
  shooterName: string,
  prior1YearTeams: Team[],
  prior2YearTeams: Team[],
  prior1AvgMap: Map<string, number> = new Map(),
  prior2AvgMap: Map<string, number> = new Map(),
): boolean {
  const key = normalizeShooterName(shooterName);

  // Returns true only if the shooter actually shot at least one round in the
  // given year — not merely appeared on a roster.
  const shotInYear = (teams: Team[], avgMap: Map<string, number>): boolean => {
    if (avgMap.has(key)) return true;
    for (const team of teams) {
      for (const shooter of team.shooters) {
        if (normalizeShooterName(shooter.name) === key) {
          return shooter.finalAvg !== null && shooter.finalAvg > 0;
        }
      }
    }
    return false;
  };

  return !shotInYear(prior1YearTeams, prior1AvgMap) && !shotInYear(prior2YearTeams, prior2AvgMap);
}

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
