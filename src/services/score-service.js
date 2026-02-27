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
