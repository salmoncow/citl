/**
 * ScoreRepository — Firestore implementation
 *
 * Data access layer for seasons, teams, shooters, and weekly results.
 * All public methods return a Result object — never throw across module boundaries.
 *
 * Firestore schema:
 *   seasons/{year}
 *   seasons/{year}/teams/{teamId}
 *   seasons/{year}/weeks/{weekNumber}
 *
 * Architecture: components → modules → services → repositories
 * This file is the innermost layer; it may only import from firebase/firestore and types.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';

/** @typedef {import('@/types/score.js').Team} Team */
/** @typedef {import('@/types/score.js').WeekResult} WeekResult */
/** @typedef {import('@/types/score.js').SeasonEntry} SeasonEntry */
/** @typedef {import('@/types/season.js').Season} Season */
/** @typedef {import('@/types/season.js').SeasonStandings} SeasonStandings */

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Result
 * @property {boolean} success
 * @property {*} [data]
 * @property {string} [error]
 * @property {string} [code]
 */

/**
 * @param {*} data
 * @returns {Result}
 */
export function success(data) {
  return { success: true, data };
}

/**
 * @param {string} error
 * @param {string} [code]
 * @returns {Result}
 */
export function failure(error, code = 'UNKNOWN_ERROR') {
  return { success: false, error, code };
}

// ---------------------------------------------------------------------------
// ScoreRepository
// ---------------------------------------------------------------------------

/**
 * Firestore-backed repository for all score and standings data.
 */
export class ScoreRepository {
  /**
   * @param {import('firebase/firestore').Firestore} db
   */
  constructor(db) {
    if (!db) throw new Error('Firestore db instance is required');
    this.db = db;
  }

  // -------------------------------------------------------------------------
  // Seasons
  // -------------------------------------------------------------------------

  /**
   * Get season metadata for a given year.
   * @param {number} year - e.g. 2025
   * @returns {Promise<Result>} Result with Season or null
   */
  async getSeason(year) {
    try {
      const ref = doc(this.db, 'seasons', String(year));
      const snap = await getDoc(ref);
      if (!snap.exists()) return success(null);
      return success({ id: snap.id, ...snap.data() });
    } catch (err) {
      return failure(`Failed to load season ${year}: ${err.message}`, 'FIRESTORE_READ_ERROR');
    }
  }

  /**
   * Get all season documents, ordered descending by year.
   * @returns {Promise<Result>} Result with Season[]
   */
  async getAllSeasons() {
    try {
      const q = query(
        collection(this.db, 'seasons'),
        orderBy('year', 'desc'),
        limit(20),
      );
      const snap = await getDocs(q);
      const seasons = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return success(seasons);
    } catch (err) {
      return failure(`Failed to load seasons: ${err.message}`, 'FIRESTORE_READ_ERROR');
    }
  }

  // -------------------------------------------------------------------------
  // Teams
  // -------------------------------------------------------------------------

  /**
   * Get all teams for a season.
   * @param {number} year
   * @returns {Promise<Result>} Result with Team[]
   */
  async getTeams(year) {
    try {
      const q = query(
        collection(this.db, 'seasons', String(year), 'teams'),
        orderBy('name', 'asc'),
        limit(20),
      );
      const snap = await getDocs(q);
      const teams = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return success(teams);
    } catch (err) {
      return failure(`Failed to load teams for ${year}: ${err.message}`, 'FIRESTORE_READ_ERROR');
    }
  }

  /**
   * Get a single team document.
   * @param {number} year
   * @param {string} teamId
   * @returns {Promise<Result>} Result with Team or null
   */
  async getTeam(year, teamId) {
    try {
      const ref = doc(this.db, 'seasons', String(year), 'teams', teamId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return success(null);
      return success({ id: snap.id, ...snap.data() });
    } catch (err) {
      return failure(`Failed to load team ${teamId}: ${err.message}`, 'FIRESTORE_READ_ERROR');
    }
  }

  // -------------------------------------------------------------------------
  // Weekly results
  // -------------------------------------------------------------------------

  /**
   * Get the results for a specific week.
   * @param {number} year
   * @param {number} weekNumber - 1–15
   * @returns {Promise<Result>} Result with WeekResult or null
   */
  async getWeekResult(year, weekNumber) {
    try {
      const ref = doc(this.db, 'seasons', String(year), 'weeks', String(weekNumber));
      const snap = await getDoc(ref);
      if (!snap.exists()) return success(null);
      return success({ id: snap.id, ...snap.data() });
    } catch (err) {
      return failure(
        `Failed to load week ${weekNumber} for ${year}: ${err.message}`,
        'FIRESTORE_READ_ERROR',
      );
    }
  }

  /**
   * Get all weekly results for a season, ordered by week number ascending.
   * @param {number} year
   * @returns {Promise<Result>} Result with WeekResult[]
   */
  async getAllWeekResults(year) {
    try {
      const q = query(
        collection(this.db, 'seasons', String(year), 'weeks'),
        orderBy('weekNumber', 'asc'),
        limit(15),
      );
      const snap = await getDocs(q);
      const weeks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return success(weeks);
    } catch (err) {
      return failure(
        `Failed to load week results for ${year}: ${err.message}`,
        'FIRESTORE_READ_ERROR',
      );
    }
  }

  /**
   * Get the most recently updated week result for a season.
   * Useful for displaying "current week" standings on the home page.
   * @param {number} year
   * @returns {Promise<Result>} Result with WeekResult or null
   */
  async getLatestWeekResult(year) {
    try {
      const q = query(
        collection(this.db, 'seasons', String(year), 'weeks'),
        orderBy('weekNumber', 'desc'),
        limit(1),
      );
      const snap = await getDocs(q);
      if (snap.empty) return success(null);
      const d = snap.docs[0];
      return success({ id: d.id, ...d.data() });
    } catch (err) {
      return failure(
        `Failed to load latest week for ${year}: ${err.message}`,
        'FIRESTORE_READ_ERROR',
      );
    }
  }

  // -------------------------------------------------------------------------
  // Admin writes
  // -------------------------------------------------------------------------

  /**
   * Save a raw admin score entry (audit trail).
   * Document ID: {weekNumber}_{teamId}
   * @param {number} year
   * @param {SeasonEntry} entry
   * @returns {Promise<Result>}
   */
  async saveEntry(year, entry) {
    try {
      if (!entry || !entry.weekNumber || !entry.teamId) {
        return failure('entry.weekNumber and entry.teamId are required', 'VALIDATION_ERROR');
      }
      const entryId = `${entry.weekNumber}_${entry.teamId}`;
      const ref = doc(this.db, 'seasons', String(year), 'entries', entryId);
      await setDoc(ref, entry);
      return success({ ...entry, id: entryId });
    } catch (err) {
      return failure(`Failed to save entry: ${err.message}`, 'FIRESTORE_WRITE_ERROR');
    }
  }

  /**
   * Get a single raw entry by week + team.
   * @param {number} year
   * @param {number} weekNumber
   * @param {string} teamId
   * @returns {Promise<Result>} Result with SeasonEntry or null
   */
  async getEntry(year, weekNumber, teamId) {
    try {
      const entryId = `${weekNumber}_${teamId}`;
      const ref = doc(this.db, 'seasons', String(year), 'entries', entryId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return success(null);
      return success({ id: snap.id, ...snap.data() });
    } catch (err) {
      return failure(`Failed to load entry: ${err.message}`, 'FIRESTORE_READ_ERROR');
    }
  }

  /**
   * Get all raw entries for weeks 1 through maxWeekNumber.
   * @param {number} year
   * @param {number} maxWeekNumber - fetch entries where weekNumber <= this value
   * @returns {Promise<Result>} Result with SeasonEntry[]
   */
  async getEntries(year, maxWeekNumber) {
    try {
      const q = query(
        collection(this.db, 'seasons', String(year), 'entries'),
        where('weekNumber', '<=', maxWeekNumber),
        limit(maxWeekNumber * 10),
      );
      const snap = await getDocs(q);
      const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return success(entries);
    } catch (err) {
      return failure(`Failed to load entries: ${err.message}`, 'FIRESTORE_READ_ERROR');
    }
  }

  /**
   * Atomically publish a computed week result and update season standings.
   * Uses a write batch: one write for WeekResult, one merge-write for season doc.
   * @param {number} year
   * @param {WeekResult} weekResult
   * @param {{ currentWeek: number, standings: SeasonStandings[] }} seasonUpdates
   * @returns {Promise<Result>}
   */
  async publishWeek(year, weekResult, seasonUpdates) {
    try {
      if (!weekResult || !weekResult.weekNumber) {
        return failure('weekResult.weekNumber is required', 'VALIDATION_ERROR');
      }
      const batch = writeBatch(this.db);

      const weekRef = doc(
        this.db,
        'seasons',
        String(year),
        'weeks',
        String(weekResult.weekNumber),
      );
      batch.set(weekRef, weekResult);

      const seasonRef = doc(this.db, 'seasons', String(year));
      batch.set(seasonRef, { year, ...seasonUpdates }, { merge: true });

      await batch.commit();
      return success({ weekResult, seasonUpdates });
    } catch (err) {
      return failure(`Failed to publish week: ${err.message}`, 'FIRESTORE_WRITE_ERROR');
    }
  }

  /**
   * Update specific fields on a season document.
   * @param {number} year
   * @param {Partial<Season>} updates
   * @returns {Promise<Result>}
   */
  async updateSeason(year, updates) {
    try {
      const ref = doc(this.db, 'seasons', String(year));
      await updateDoc(ref, updates);
      return success(updates);
    } catch (err) {
      return failure(`Failed to update season ${year}: ${err.message}`, 'FIRESTORE_WRITE_ERROR');
    }
  }
}
