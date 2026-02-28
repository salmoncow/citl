/**
 * LocalStorageScoreRepository
 *
 * localStorage backend implementing the same public interface as ScoreRepository.
 * Enables score data to be stored and retrieved without Firestore credentials —
 * useful for local development and admin data entry before Firestore is enabled.
 *
 * Key schema:
 *   citl:season:{year}       → Season object (JSON)
 *   citl:teams:{year}        → Team[] array (JSON)
 *   citl:week:{year}:{n}     → WeekResult for week n (JSON)
 *
 * All methods return the Result pattern: { success, data } or { success: false, error, code }.
 * All methods are async to match the ScoreRepository interface (future Firestore swap).
 *
 * See: ADR-006 in .prompts/meta/architectural-decision-log.md
 */

import { success, failure } from './score-repository.js';

const KEY_PREFIX = 'citl';

// ---------------------------------------------------------------------------
// Key builders
// ---------------------------------------------------------------------------

/** @param {number} year */
const seasonKey = (year) => `${KEY_PREFIX}:season:${year}`;

/** @param {number} year */
const teamsKey = (year) => `${KEY_PREFIX}:teams:${year}`;

/** @param {number} year @param {number} weekNumber */
const weekKey = (year, weekNumber) => `${KEY_PREFIX}:week:${year}:${weekNumber}`;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read and parse a JSON value from localStorage.
 * @param {string} key
 * @returns {*|null}
 */
function lsGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Serialize and write a value to localStorage.
 * @param {string} key
 * @param {*} value
 */
function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// LocalStorageScoreRepository
// ---------------------------------------------------------------------------

/**
 * localStorage-backed repository for all score and standings data.
 * Mirrors the public interface of ScoreRepository (score-repository.js).
 */
export class LocalStorageScoreRepository {

  // -------------------------------------------------------------------------
  // Seasons
  // -------------------------------------------------------------------------

  /**
   * Get season metadata for a given year.
   * @param {number} year
   * @returns {Promise<import('./score-repository.js').Result>}
   */
  async getSeason(year) {
    try {
      const data = lsGet(seasonKey(year));
      return success(data);
    } catch (err) {
      return failure(`Failed to load season ${year}: ${err.message}`, 'LS_READ_ERROR');
    }
  }

  /**
   * Get all stored seasons, ordered descending by year.
   * Scans localStorage keys matching the season key pattern.
   * @returns {Promise<import('./score-repository.js').Result>}
   */
  async getAllSeasons() {
    try {
      const seasons = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(`${KEY_PREFIX}:season:`)) continue;
        const data = lsGet(key);
        if (data) seasons.push(data);
      }
      seasons.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      return success(seasons);
    } catch (err) {
      return failure(`Failed to load seasons: ${err.message}`, 'LS_READ_ERROR');
    }
  }

  // -------------------------------------------------------------------------
  // Teams
  // -------------------------------------------------------------------------

  /**
   * Get all teams for a season.
   * @param {number} year
   * @returns {Promise<import('./score-repository.js').Result>}
   */
  async getTeams(year) {
    try {
      const data = lsGet(teamsKey(year)) ?? [];
      return success(data);
    } catch (err) {
      return failure(`Failed to load teams for ${year}: ${err.message}`, 'LS_READ_ERROR');
    }
  }

  /**
   * Get a single team by teamId.
   * @param {number} year
   * @param {string} teamId
   * @returns {Promise<import('./score-repository.js').Result>}
   */
  async getTeam(year, teamId) {
    try {
      const teams = lsGet(teamsKey(year)) ?? [];
      const team = teams.find((t) => t.id === teamId) ?? null;
      return success(team);
    } catch (err) {
      return failure(`Failed to load team ${teamId}: ${err.message}`, 'LS_READ_ERROR');
    }
  }

  // -------------------------------------------------------------------------
  // Weekly results
  // -------------------------------------------------------------------------

  /**
   * Get the results for a specific week.
   * @param {number} year
   * @param {number} weekNumber  1–15
   * @returns {Promise<import('./score-repository.js').Result>}
   */
  async getWeekResult(year, weekNumber) {
    try {
      const data = lsGet(weekKey(year, weekNumber));
      return success(data);
    } catch (err) {
      return failure(
        `Failed to load week ${weekNumber} for ${year}: ${err.message}`,
        'LS_READ_ERROR',
      );
    }
  }

  /**
   * Get all weekly results for a season, ordered by week number ascending.
   * @param {number} year
   * @returns {Promise<import('./score-repository.js').Result>}
   */
  async getAllWeekResults(year) {
    try {
      const weeks = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const prefix = `${KEY_PREFIX}:week:${year}:`;
        if (!key || !key.startsWith(prefix)) continue;
        const data = lsGet(key);
        if (data) weeks.push(data);
      }
      weeks.sort((a, b) => (a.weekNumber ?? 0) - (b.weekNumber ?? 0));
      return success(weeks);
    } catch (err) {
      return failure(
        `Failed to load week results for ${year}: ${err.message}`,
        'LS_READ_ERROR',
      );
    }
  }

  /**
   * Get the highest-numbered week result stored for a season.
   * @param {number} year
   * @returns {Promise<import('./score-repository.js').Result>}
   */
  async getLatestWeekResult(year) {
    try {
      const result = await this.getAllWeekResults(year);
      if (!result.success) return result;
      const weeks = result.data;
      const latest = weeks.length > 0 ? weeks[weeks.length - 1] : null;
      return success(latest);
    } catch (err) {
      return failure(
        `Failed to load latest week for ${year}: ${err.message}`,
        'LS_READ_ERROR',
      );
    }
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  /**
   * Write or overwrite a week result.
   * @param {number} year
   * @param {import('../types/score.js').WeekResult} weekResult
   * @returns {Promise<import('./score-repository.js').Result>}
   */
  async saveWeekResult(year, weekResult) {
    try {
      if (!weekResult || !weekResult.weekNumber) {
        return failure('weekResult.weekNumber is required', 'VALIDATION_ERROR');
      }
      lsSet(weekKey(year, weekResult.weekNumber), weekResult);
      return success(weekResult);
    } catch (err) {
      return failure(`Failed to save week result: ${err.message}`, 'LS_WRITE_ERROR');
    }
  }

  /**
   * Update specific fields on a season document.
   * Merges updates into the existing stored season (or creates it if absent).
   * @param {number} year
   * @param {Partial<import('../types/season.js').Season>} updates
   * @returns {Promise<import('./score-repository.js').Result>}
   */
  async updateSeason(year, updates) {
    try {
      const existing = lsGet(seasonKey(year)) ?? {};
      const merged = { ...existing, ...updates };
      lsSet(seasonKey(year), merged);
      return success(merged);
    } catch (err) {
      return failure(`Failed to update season ${year}: ${err.message}`, 'LS_WRITE_ERROR');
    }
  }

  /**
   * Save or replace the full teams array for a season.
   * @param {number} year
   * @param {import('../types/score.js').Team[]} teams
   * @returns {Promise<import('./score-repository.js').Result>}
   */
  async saveTeams(year, teams) {
    try {
      lsSet(teamsKey(year), teams);
      return success(teams);
    } catch (err) {
      return failure(`Failed to save teams for ${year}: ${err.message}`, 'LS_WRITE_ERROR');
    }
  }
}
