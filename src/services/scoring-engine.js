/**
 * Scoring Engine — Pure Computation Service
 *
 * All functions are pure: no I/O, no side effects, no framework dependencies.
 * Processes the CITL trap league business rules for averages, bonuses, rank
 * points, and season awards.
 *
 * Architecture: this file may only import from types/. Never import from
 * repositories, services, or views.
 *
 * See: .specs/features/scoring-engine.md for full business rules.
 * See: ADR-006 in .prompts/meta/architectural-decision-log.md.
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** @param {(number|null)[]} arr */
function mean(arr) {
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
 *
 * @param {number} startingAvg  W0 (prior season final avg or 35 for rookies)
 * @param {(number|null)[]} scores  W1–W15 array (null = did not shoot)
 * @param {number} weekIndex  0-based; compute average using scores[0..weekIndex-1]
 * @returns {number}
 */
export function computeGoingInAverage(startingAvg, scores, weekIndex) {
  if (weekIndex === 0) return startingAvg;

  const priorScores = scores.slice(0, weekIndex).filter((s) => s !== null);
  const weeksShot = priorScores.length;

  if (weeksShot === 0) return startingAvg;
  if (weeksShot < 2) return mean([startingAvg, ...priorScores]);
  return mean(priorScores);
}

/**
 * Compute a shooter's current average THROUGH a given week (inclusive).
 * Used for final average calculation and standings display.
 *
 * @param {number} startingAvg
 * @param {(number|null)[]} scores
 * @param {number} throughWeekIndex  inclusive 0-based index; -1 = no weeks shot → return startingAvg
 * @returns {number}
 */
export function computeShooterAverage(startingAvg, scores, throughWeekIndex) {
  if (throughWeekIndex < 0) return startingAvg;

  const throughScores = scores.slice(0, throughWeekIndex + 1).filter((s) => s !== null);
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
 *
 * @param {import('../types/scorecard.js').Shooter[]} shooters
 * @param {number} weekIndex  0-based (W1 = 0, W15 = 14)
 * @returns {number}  0 if no one shot (forfeit or absent week)
 */
export function computeTeamTargets(shooters, weekIndex) {
  return shooters.reduce((sum, s) => {
    const score = s.scores[weekIndex];
    return score !== null ? sum + score : sum;
  }, 0);
}

/**
 * Compute the going-in average sum for the bonus points calculation.
 *
 * For real shooters who shot this week: their individual going-in average.
 * For dummies who shot this week: dummy going-in avg = mean of real shooters'
 *   going-in avgs this week (computed first, so no circular dependency).
 * Only includes shooters who actually shot this week (non-null score).
 *
 * @param {import('../types/scorecard.js').Shooter[]} shooters
 * @param {number} weekIndex
 * @returns {number}
 */
export function computeGoingInAverageSum(shooters, weekIndex) {
  const realShootersWhoShot = shooters.filter(
    (s) => !s.isDummy && s.scores[weekIndex] !== null,
  );
  const dummiesWhoShot = shooters.filter(
    (s) => s.isDummy && s.scores[weekIndex] !== null,
  );

  // Compute going-in avg for each real shooter who shot
  const realGoingInAvgs = realShootersWhoShot.map((s) =>
    computeGoingInAverage(s.startingAvg, s.scores, weekIndex),
  );

  // Dummies use the mean of real shooters' going-in avgs
  const dummyGoingInAvg = realGoingInAvgs.length > 0 ? mean(realGoingInAvgs) : 0;

  const realSum = realGoingInAvgs.reduce((a, b) => a + b, 0);
  const dummySum = dummiesWhoShot.length * dummyGoingInAvg;

  return realSum + dummySum;
}

/**
 * Compute the target component of bonus points: +5 if team targets exceed the going-in sum.
 *
 * @param {number} teamTargets
 * @param {number} goingInSum
 * @returns {5|null}  5 if targets > goingInSum, null otherwise
 */
export function computeTargetBonus(teamTargets, goingInSum) {
  return teamTargets > goingInSum ? 5 : null;
}

/**
 * Award +1 point per rookie whose going-in avg < 35 AND who shot this week;
 * maximum 2 points. Not awarded for weekIndex >= 10 (W11–W15).
 * Dummies excluded.
 *
 * @param {import('../types/scorecard.js').Shooter[]} shooters
 * @param {number} weekIndex
 * @returns {number}  0, 1, or 2
 */
export function computeRookieBonus(shooters, weekIndex) {
  if (weekIndex >= 10) return 0;

  let bonus = 0;
  for (const shooter of shooters) {
    if (shooter.isDummy || !shooter.rookie) continue;
    if (shooter.scores[weekIndex] === null) continue; // must have shot

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
 *   Example: 2 teams tied for Rank 1 → each gets (30 + 28) / 2 = 29.
 *
 * Teams with null targets are excluded from ranking and receive null.
 *
 * @param {(number|null)[]} allTeamTargets  one entry per team, same order
 * @returns {(number|null)[]}  rank points in same order; null for non-participating teams
 */
export function computeRankPoints(allTeamTargets) {
  const n = allTeamTargets.length;
  const result = new Array(n).fill(null);

  // Collect participating indices (non-null; 0 is valid = forfeit, ranks last)
  const participants = allTeamTargets
    .map((targets, i) => ({ targets, i }))
    .filter(({ targets }) => targets !== null);

  if (participants.length === 0) return result;

  // Sort descending by targets
  participants.sort((a, b) => b.targets - a.targets);

  // Assign rank points with tie-splitting
  let pos = 0; // position in sorted array (0-based)
  while (pos < participants.length) {
    const currentTargets = participants[pos].targets;

    // Find all tied at this position
    let tieEnd = pos + 1;
    while (tieEnd < participants.length && participants[tieEnd].targets === currentTargets) {
      tieEnd++;
    }
    const tieCount = tieEnd - pos;

    // Points for ranks pos+1 through pos+tieCount (1-indexed ranks)
    let pointsSum = 0;
    for (let r = pos; r < tieEnd; r++) {
      pointsSum += 30 - r * 2; // Rank (r+1): 30, 28, 26, ...
    }
    const tiePoints = pointsSum / tieCount;

    for (let r = pos; r < tieEnd; r++) {
      result[participants[r].i] = tiePoints;
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
 *
 * Forfeit rule: if no shooter on a team had a non-null score for a week,
 * the team forfeited — targets stored as null, but 0 is used for rank
 * calculation so they rank last and still receive rank points.
 *
 * @param {import('../types/scorecard.js').SeasonData} seasonData  raw input (scores only)
 * @returns {import('../types/scorecard.js').SeasonData}  new object with totals populated
 */
export function computeSeasonTotals(seasonData) {
  const WEEK_COUNT = 15;
  const teams = seasonData.teams;

  // Initialize output totals arrays for each team
  const teamTotals = teams.map(() => ({
    targets:    new Array(WEEK_COUNT).fill(null),
    rankPoints: new Array(WEEK_COUNT).fill(null),
    bonusPoints: new Array(WEEK_COUNT).fill(null),
  }));

  for (let wi = 0; wi < WEEK_COUNT; wi++) {
    // 1. Compute team targets and bonus points for each team
    const weekTargets = [];

    for (let ti = 0; ti < teams.length; ti++) {
      const { shooters } = teams[ti];

      const targets = computeTeamTargets(shooters, wi);
      const goingInSum = computeGoingInAverageSum(shooters, wi);
      const targetBonus = computeTargetBonus(targets, goingInSum);
      const rookieBonus = computeRookieBonus(shooters, wi);
      const totalBonus = (targetBonus === null && rookieBonus === 0)
        ? null
        : (targetBonus ?? 0) + rookieBonus;

      // Determine if team participated: at least one shooter had a non-null score
      const anyoneShot = shooters.some((s) => s.scores[wi] !== null);
      const storedTargets = anyoneShot ? targets : null;

      teamTotals[ti].targets[wi] = storedTargets;
      teamTotals[ti].bonusPoints[wi] = totalBonus;

      // For rank calculation: forfeit (anyoneShot=false) uses 0 → ranks last.
      // null is never pushed; every registered team participates in ranking.
      weekTargets.push(anyoneShot ? targets : 0);
    }

    // 2. Compute rank points across all teams for this week
    const rankPoints = computeRankPoints(weekTargets);
    for (let ti = 0; ti < teams.length; ti++) {
      teamTotals[ti].rankPoints[wi] = rankPoints[ti];
    }
  }

  // 3. Build and return new SeasonData (no mutation of input)
  return {
    season: seasonData.season,
    teams: teams.map((team, ti) => ({
      ...team,
      totals: teamTotals[ti],
    })),
  };
}

// ---------------------------------------------------------------------------
// Season awards
// ---------------------------------------------------------------------------

/**
 * Compute the Most Improved percentage score.
 * Formula: 100 × (finalAvg − startingAvg) / (50 − startingAvg)
 *
 * @param {number} startingAvg
 * @param {number} finalAvg
 * @returns {number}
 */
export function computeMostImprovedScore(startingAvg, finalAvg) {
  return (100 * (finalAvg - startingAvg)) / (50 - startingAvg);
}

/**
 * Compute season awards from final shooter averages.
 * Excludes dummy shooters. Requires weeksShot >= 6.
 *
 * Returns partial SeasonAwards (shooter-based awards only; team standings
 * awards are computed separately from cumulative rank+bonus totals).
 *
 * @param {import('../types/scorecard.js').SeasonData} seasonData
 * @returns {import('../types/season.js').SeasonAwards}
 */
export function computeSeasonAwards(seasonData) {
  const WEEK_COUNT = 15;
  const MIN_WEEKS = 6;

  /** @type {{ name: string, teamName: string, finalAvg: number, startingAvg: number, rookie: boolean, weeksShot: number }[]} */
  const eligible = [];

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

  // Highest average
  const topShooter = eligible.reduce((best, s) => s.finalAvg > best.finalAvg ? s : best);

  // Rookie of the Year
  const rookies = eligible.filter((s) => s.rookie);
  const topRookie = rookies.length > 0
    ? rookies.reduce((best, s) => s.finalAvg > best.finalAvg ? s : best)
    : null;

  // Most Improved
  const topImproved = eligible.reduce((best, s) => {
    const score = computeMostImprovedScore(s.startingAvg, s.finalAvg);
    const bestScore = computeMostImprovedScore(best.startingAvg, best.finalAvg);
    return score > bestScore ? s : best;
  });
  const improvementScore = computeMostImprovedScore(topImproved.startingAvg, topImproved.finalAvg);
  const improvementPct = `${improvementScore.toFixed(2)}%`;

  return {
    firstPlaceTeam: null,    // computed separately from cumulative standings
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
