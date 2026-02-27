/**
 * StandingsService — business logic for computing and presenting standings
 *
 * Builds on ScoreService to provide:
 *   - Cumulative standings across all weeks shot (for the home page)
 *   - Per-week standings snapshots (for the results feed)
 *   - Top-shooter-per-team summary
 *   - Season awards summary
 *
 * All methods return a Result object.
 *
 * Usage:
 *   import { StandingsService } from '@/services/standings-service.js';
 *   const standingsService = new StandingsService(scoreService);
 *
 *   const result = await standingsService.getCurrentStandings(2025);
 *   if (!result.success) { console.error(result.error); return; }
 *   renderStandings(result.data);
 */

import { success, failure } from '@/repositories/score-repository.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Sum an array, treating null as 0.
 * @param {(number|null)[]} arr
 * @returns {number}
 */
function sumNullable(arr) {
  return arr.reduce((acc, v) => acc + (v ?? 0), 0);
}

/**
 * Compute cumulative standings from a WeekResult standings array through a
 * given week index (0-based). Returns rows sorted by totalPoints desc.
 *
 * @param {import('@/types/score.js').WeekResult[]} weeks - All week results, sorted asc
 * @param {number} throughWeekIndex - Inclusive upper bound (0-based index into weeks[])
 * @returns {import('@/types/score.js').StandingRow[]}
 */
function computeStandings(weeks, throughWeekIndex) {
  /** @type {Map<string, import('@/types/score.js').StandingRow>} */
  const teamMap = new Map();

  for (let i = 0; i <= throughWeekIndex && i < weeks.length; i++) {
    const week = weeks[i];
    for (const row of week.standings) {
      const existing = teamMap.get(row.teamId) ?? {
        teamId: row.teamId,
        teamName: row.teamName,
        captain: row.captain,
        weekTargets: 0,
        totalTargets: 0,
        rankPoints: 0,
        bonusPoints: 0,
        totalPoints: 0,
        standing: 0,
      };

      // weekTargets shows the LATEST week's targets only
      existing.weekTargets = row.weekTargets;
      existing.totalTargets = row.totalTargets;
      // Points accumulate
      existing.rankPoints += row.rankPoints;
      existing.bonusPoints += row.bonusPoints;
      existing.totalPoints += row.rankPoints + row.bonusPoints;

      teamMap.set(row.teamId, existing);
    }
  }

  const rows = Array.from(teamMap.values())
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((row, idx) => ({ ...row, standing: idx + 1 }));

  return rows;
}

// ---------------------------------------------------------------------------
// StandingsService
// ---------------------------------------------------------------------------

export class StandingsService {
  /**
   * @param {import('@/services/score-service.js').ScoreService} scoreService
   */
  constructor(scoreService) {
    if (!scoreService) throw new Error('StandingsService: scoreService is required');
    this.scoreService = scoreService;
  }

  /**
   * Get cumulative standings through the most recently entered week.
   * This is the primary data source for the home page standings table.
   *
   * @param {number} year
   * @returns {Promise<import('@/repositories/score-repository.js').Result>}
   *   Result with { standings: StandingRow[], latestWeek: number }
   */
  async getCurrentStandings(year) {
    const weeksResult = await this.scoreService.getAllWeekResults(year);
    if (!weeksResult.success) return weeksResult;

    const weeks = weeksResult.data;
    if (!weeks || weeks.length === 0) {
      return success({ standings: [], latestWeek: 0 });
    }

    const latestWeek = weeks[weeks.length - 1].weekNumber;
    const standings = computeStandings(weeks, weeks.length - 1);

    return success({ standings, latestWeek });
  }

  /**
   * Get standings as they were at the end of a specific week.
   *
   * @param {number} year
   * @param {number} weekNumber - 1–15
   * @returns {Promise<import('@/repositories/score-repository.js').Result>}
   *   Result with StandingRow[]
   */
  async getStandingsAtWeek(year, weekNumber) {
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 15) {
      return failure(`Invalid weekNumber: ${weekNumber}`, 'VALIDATION_ERROR');
    }

    const weeksResult = await this.scoreService.getAllWeekResults(year);
    if (!weeksResult.success) return weeksResult;

    const weeks = weeksResult.data;
    // Find the index of the requested week (weeks are sorted asc by weekNumber)
    const idx = weeks.findIndex((w) => w.weekNumber === weekNumber);
    if (idx === -1) {
      return success([]); // week not yet entered
    }

    const standings = computeStandings(weeks, idx);
    return success(standings);
  }

  /**
   * Build the full results feed for the home page:
   * a list of weeks in descending order, each containing standings + accolades.
   *
   * @param {number} year
   * @returns {Promise<import('@/repositories/score-repository.js').Result>}
   *   Result with WeekFeedEntry[]
   */
  async getResultsFeed(year) {
    const weeksResult = await this.scoreService.getAllWeekResults(year);
    if (!weeksResult.success) return weeksResult;

    const weeks = weeksResult.data;
    if (!weeks || weeks.length === 0) return success([]);

    /** @type {Array<{weekNumber: number, updatedAt: string, accolades: *, standings: import('@/types/score.js').StandingRow[]}>} */
    const feed = [];

    for (let i = weeks.length - 1; i >= 0; i--) {
      const standings = computeStandings(weeks, i);
      feed.push({
        weekNumber: weeks[i].weekNumber,
        updatedAt: weeks[i].updatedAt,
        accolades: weeks[i].accolades ?? [],
        standings,
      });
    }

    return success(feed);
  }

  /**
   * Get season awards (trophies / accolades) for a completed season.
   *
   * @param {number} year
   * @returns {Promise<import('@/repositories/score-repository.js').Result>}
   *   Result with SeasonAwards or null if season not completed
   */
  async getSeasonAwards(year) {
    const seasonResult = await this.scoreService.getSeason(year);
    if (!seasonResult.success) return seasonResult;
    if (!seasonResult.data) return success(null);
    return success(seasonResult.data.awards ?? null);
  }

  /**
   * Get top-shooter-per-team for a season (min 6 weeks shot).
   *
   * @param {number} year
   * @returns {Promise<import('@/repositories/score-repository.js').Result>}
   *   Result with TeamTopShooter[]
   */
  async getTopShootersByTeam(year) {
    const seasonResult = await this.scoreService.getSeason(year);
    if (!seasonResult.success) return seasonResult;
    if (!seasonResult.data) return success([]);
    return success(seasonResult.data.topShootersByTeam ?? []);
  }
}
