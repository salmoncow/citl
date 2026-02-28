/**
 * ScoreService — business logic for shooter scores
 *
 * Wraps ScoreRepository with:
 *   - 1-hour in-memory cache for season / team data
 *   - Input validation
 *   - Result pattern (never throws across module boundaries)
 *
 * Usage:
 *   import { ScoreService } from '@/services/score-service.js';
 *   import { createRepositoryFactory } from '@/repositories/repository-factory.js';
 *   import { db } from '@/firebase-config.js';
 *
 *   const factory = createRepositoryFactory({ db });
 *   const scoreService = new ScoreService(factory.getScoreRepository());
 *
 *   const result = await scoreService.getSeason(2025);
 *   if (!result.success) { console.error(result.error); return; }
 *   render(result.data);
 */

import { success, failure } from '@/repositories/score-repository.js';
import { computeSeasonTotals } from '@/services/scoring-engine.js';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} CacheEntry
 * @property {*} data
 * @property {number} ts - timestamp of cache write
 */

/**
 * @param {Map<string, CacheEntry>} cache
 * @param {string} key
 * @param {number} ttl
 * @returns {*|undefined} cached data, or undefined on miss / expiry
 */
function getCached(cache, key, ttl = CACHE_TTL_MS) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > ttl) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

/**
 * @param {Map<string, CacheEntry>} cache
 * @param {string} key
 * @param {*} data
 */
function setCache(cache, key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// ---------------------------------------------------------------------------
// ScoreService
// ---------------------------------------------------------------------------

export class ScoreService {
  /**
   * @param {import('@/repositories/score-repository.js').ScoreRepository} repository
   */
  constructor(repository) {
    if (!repository) throw new Error('ScoreService: repository is required');
    this.repository = repository;
    /** @type {Map<string, CacheEntry>} */
    this.cache = new Map();
  }

  // -------------------------------------------------------------------------
  // Seasons
  // -------------------------------------------------------------------------

  /**
   * Get season metadata for a given year.
   * @param {number} year
   * @returns {Promise<import('@/repositories/score-repository.js').Result>}
   */
  async getSeason(year) {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }

    const cacheKey = `season:${year}`;
    const cached = getCached(this.cache, cacheKey);
    if (cached !== undefined) return success(cached);

    const result = await this.repository.getSeason(year);
    if (result.success && result.data) setCache(this.cache, cacheKey, result.data);
    return result;
  }

  /**
   * Get all available seasons, newest first.
   * @returns {Promise<import('@/repositories/score-repository.js').Result>}
   */
  async getAllSeasons() {
    const cacheKey = 'seasons:all';
    const cached = getCached(this.cache, cacheKey);
    if (cached !== undefined) return success(cached);

    const result = await this.repository.getAllSeasons();
    if (result.success) setCache(this.cache, cacheKey, result.data);
    return result;
  }

  // -------------------------------------------------------------------------
  // Teams
  // -------------------------------------------------------------------------

  /**
   * Get all teams for a season.
   * @param {number} year
   * @returns {Promise<import('@/repositories/score-repository.js').Result>}
   */
  async getTeams(year) {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }

    const cacheKey = `teams:${year}`;
    const cached = getCached(this.cache, cacheKey);
    if (cached !== undefined) return success(cached);

    const result = await this.repository.getTeams(year);
    if (result.success) setCache(this.cache, cacheKey, result.data);
    return result;
  }

  // -------------------------------------------------------------------------
  // Weekly results
  // -------------------------------------------------------------------------

  /**
   * Get a specific week's results.
   * @param {number} year
   * @param {number} weekNumber - 1–15
   * @returns {Promise<import('@/repositories/score-repository.js').Result>}
   */
  async getWeekResult(year, weekNumber) {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 15) {
      return failure(`Invalid weekNumber: ${weekNumber} (must be 1–15)`, 'VALIDATION_ERROR');
    }

    const cacheKey = `week:${year}:${weekNumber}`;
    const cached = getCached(this.cache, cacheKey);
    if (cached !== undefined) return success(cached);

    const result = await this.repository.getWeekResult(year, weekNumber);
    if (result.success && result.data) setCache(this.cache, cacheKey, result.data);
    return result;
  }

  /**
   * Get all weekly results for a season.
   * @param {number} year
   * @returns {Promise<import('@/repositories/score-repository.js').Result>}
   */
  async getAllWeekResults(year) {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }

    const cacheKey = `weeks:${year}`;
    const cached = getCached(this.cache, cacheKey);
    if (cached !== undefined) return success(cached);

    const result = await this.repository.getAllWeekResults(year);
    if (result.success) setCache(this.cache, cacheKey, result.data);
    return result;
  }

  /**
   * Get the most recently entered week result for a season.
   * Short-lived cache (5 min) since this changes during an active season.
   * @param {number} year
   * @returns {Promise<import('@/repositories/score-repository.js').Result>}
   */
  async getLatestWeekResult(year) {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }

    const cacheKey = `latest:${year}`;
    const cached = getCached(this.cache, cacheKey, 5 * 60 * 1000); // 5 min TTL
    if (cached !== undefined) return success(cached);

    const result = await this.repository.getLatestWeekResult(year);
    if (result.success && result.data) setCache(this.cache, cacheKey, result.data);
    return result;
  }

  // -------------------------------------------------------------------------
  // Admin writes
  // -------------------------------------------------------------------------

  /**
   * Save a raw score entry for one team/week to Firestore.
   * @param {number} year
   * @param {import('@/types/score.js').SeasonEntry} entry
   * @returns {Promise<import('@/repositories/score-repository.js').Result>}
   */
  async saveEntry(year, entry) {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!entry || !entry.weekNumber || !entry.teamId || !entry.teamName) {
      return failure('entry.weekNumber, teamId, and teamName are required', 'VALIDATION_ERROR');
    }
    if (!Array.isArray(entry.shooters) || entry.shooters.length === 0) {
      return failure('entry.shooters must be a non-empty array', 'VALIDATION_ERROR');
    }
    return this.repository.saveEntry(year, entry);
  }

  /**
   * Get a single raw entry.
   * @param {number} year
   * @param {number} weekNumber
   * @param {string} teamId
   * @returns {Promise<import('@/repositories/score-repository.js').Result>}
   */
  async getEntry(year, weekNumber, teamId) {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 15) {
      return failure(`Invalid weekNumber: ${weekNumber}`, 'VALIDATION_ERROR');
    }
    return this.repository.getEntry(year, weekNumber, teamId);
  }

  /**
   * Get all raw entries for weeks 1 through maxWeekNumber.
   * @param {number} year
   * @param {number} maxWeekNumber
   * @returns {Promise<import('@/repositories/score-repository.js').Result>}
   */
  async getEntries(year, maxWeekNumber) {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!Number.isInteger(maxWeekNumber) || maxWeekNumber < 1 || maxWeekNumber > 15) {
      return failure(`Invalid maxWeekNumber: ${maxWeekNumber}`, 'VALIDATION_ERROR');
    }
    return this.repository.getEntries(year, maxWeekNumber);
  }

  /**
   * Publish a week:
   *  1. Fetch all entries for weeks 1–weekNumber
   *  2. Fetch team rosters for starting averages
   *  3. Build SeasonData → run computeSeasonTotals
   *  4. Write WeekResult + update season standings (atomic batch)
   *
   * @param {number} year
   * @param {number} weekNumber - the week to publish (1–15)
   * @returns {Promise<import('@/repositories/score-repository.js').Result>}
   */
  async publishWeek(year, weekNumber) {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 15) {
      return failure(`Invalid weekNumber: ${weekNumber}`, 'VALIDATION_ERROR');
    }

    // 1. Fetch all entries for weeks 1–weekNumber
    const entriesResult = await this.repository.getEntries(year, weekNumber);
    if (!entriesResult.success) return entriesResult;
    const entries = entriesResult.data;

    if (entries.length === 0) {
      return failure(`No entries found for ${year} weeks 1–${weekNumber}`, 'NO_DATA');
    }

    // 2. Fetch team rosters
    const teamsResult = await this.repository.getTeams(year);
    if (!teamsResult.success) return teamsResult;
    const teams = teamsResult.data;

    // 3. Build SeasonData from rosters + entries
    const seasonData = _buildSeasonData(year, teams, entries, weekNumber);

    // 4. Run scoring engine
    const computed = computeSeasonTotals(seasonData);

    // 5. Build WeekResult for the published week (weekIndex = weekNumber - 1)
    const wi = weekNumber - 1;
    const teamResults = computed.teams.map((team) => {
      const teamEntry = entries.find(
        (e) => e.weekNumber === weekNumber && e.teamName === team.name,
      );
      return {
        teamId: _slugify(team.name),
        teamName: team.name,
        targets: team.totals.targets[wi] ?? 0,
        rankPoints: team.totals.rankPoints[wi] ?? 0,
        bonusPoints: team.totals.bonusPoints[wi] ?? 0,
        shooterScores: teamEntry ? teamEntry.shooters : [],
      };
    });

    /** @type {import('@/types/score.js').WeekResult} */
    const weekResult = {
      weekNumber,
      publishedAt: new Date().toISOString(),
      teamResults,
    };

    // 6. Compute cumulative standings through this week
    const standings = _computeStandings(computed, weekNumber);

    // 7. Atomic publish
    const publishResult = await this.repository.publishWeek(year, weekResult, {
      currentWeek: weekNumber,
      standings,
      status: 'active',
    });

    if (publishResult.success) {
      this.invalidateWeek(year, weekNumber);
      this.cache.delete(`season:${year}`);
    }

    return publishResult;
  }

  // -------------------------------------------------------------------------
  // Cache control
  // -------------------------------------------------------------------------

  /** Invalidate a specific week (call after admin writes a new result). */
  invalidateWeek(year, weekNumber) {
    this.cache.delete(`week:${year}:${weekNumber}`);
    this.cache.delete(`weeks:${year}`);
    this.cache.delete(`latest:${year}`);
  }

  /** Clear all cached data. */
  clearCache() {
    this.cache.clear();
  }
}

// ---------------------------------------------------------------------------
// Private helpers for publishWeek
// ---------------------------------------------------------------------------

/**
 * @param {string} name
 * @returns {string}
 */
function _slugify(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Build a SeasonData object from Firestore team rosters and raw entries.
 * Shooter scores are populated from entries for each week.
 * Shooters who appear in entries but not on the roster are added as unknowns.
 *
 * @param {number} year
 * @param {Array} firestoreTeams - team docs from seasons/{year}/teams/
 * @param {import('@/types/score.js').SeasonEntry[]} entries
 * @param {number} maxWeek - only populate scores for weeks 1–maxWeek
 * @returns {import('@/types/scorecard.js').SeasonData}
 */
function _buildSeasonData(year, firestoreTeams, entries, maxWeek) {
  const WEEK_COUNT = 15;

  // Group entries by teamName and weekNumber for fast lookup
  /** @type {Map<string, Map<number, import('@/types/score.js').SeasonEntry>>} */
  const entryMap = new Map();
  for (const entry of entries) {
    if (!entryMap.has(entry.teamName)) entryMap.set(entry.teamName, new Map());
    entryMap.get(entry.teamName).set(entry.weekNumber, entry);
  }

  // Build teams. Use Firestore roster as the primary source of shooter metadata.
  const teams = firestoreTeams.map((firestoreTeam) => {
    const teamEntries = entryMap.get(firestoreTeam.name) ?? new Map();

    // Collect all shooter names seen across entries for this team
    const seenNames = new Set();
    for (const [wn, entry] of teamEntries) {
      if (wn > maxWeek) continue;
      for (const s of entry.shooters) seenNames.add(s.name);
    }

    // Build shooter list: roster first, then any entry-only names (subs/guests)
    const rosterShooters = (firestoreTeam.shooters ?? []).map((rs) => {
      seenNames.delete(rs.name);
      return {
        name: rs.name,
        rookie: rs.rookie ?? false,
        isDummy: rs.name.toUpperCase().includes('DUMMY'),
        startingAvg: rs.startingAvg ?? 35,
        scores: new Array(WEEK_COUNT).fill(null),
      };
    });

    const subShooters = [...seenNames].map((name) => ({
      name,
      rookie: false,
      isDummy: name.toUpperCase().includes('DUMMY'),
      startingAvg: 35,
      scores: new Array(WEEK_COUNT).fill(null),
    }));

    const shooters = [...rosterShooters, ...subShooters];

    // Fill in scores from entries
    for (let wn = 1; wn <= maxWeek; wn++) {
      const entry = teamEntries.get(wn);
      if (!entry) continue;
      const wi = wn - 1;
      for (const entryShooter of entry.shooters) {
        const shooter = shooters.find((s) => s.name === entryShooter.name);
        if (shooter) shooter.scores[wi] = entryShooter.total;
      }
    }

    return {
      name: firestoreTeam.name,
      shooters,
      totals: {
        targets: new Array(WEEK_COUNT).fill(null),
        rankPoints: new Array(WEEK_COUNT).fill(null),
        bonusPoints: new Array(WEEK_COUNT).fill(null),
      },
    };
  });

  return { season: year, teams };
}

/**
 * Compute cumulative season standings through a given week from computed SeasonData.
 *
 * @param {import('@/types/scorecard.js').SeasonData} computed
 * @param {number} throughWeek - inclusive
 * @returns {import('@/types/season.js').SeasonStandings[]}
 */
function _computeStandings(computed, throughWeek) {
  const rows = computed.teams.map((team) => {
    let totalRankPoints = 0;
    let totalBonusPoints = 0;
    let totalTargets = 0;

    for (let wi = 0; wi < throughWeek; wi++) {
      totalRankPoints += team.totals.rankPoints[wi] ?? 0;
      totalBonusPoints += team.totals.bonusPoints[wi] ?? 0;
      totalTargets += team.totals.targets[wi] ?? 0;
    }

    return {
      teamId: _slugify(team.name),
      teamName: team.name,
      totalRankPoints,
      totalBonusPoints,
      totalTargets,
    };
  });

  // Sort by total points descending, assign ranks
  rows.sort((a, b) => (b.totalRankPoints + b.totalBonusPoints) - (a.totalRankPoints + a.totalBonusPoints));

  return rows.map((row, i) => ({ rank: i + 1, ...row }));
}
