/**
 * @file Season type definitions
 *
 * JSDoc typedefs for season-level data shapes.
 * No runtime code — for IDE support only.
 */

/**
 * Season-level trophy / award winners.
 *
 * @typedef {Object} SeasonAwards
 * @property {string} firstPlaceTeam       - Team name
 * @property {number} firstPlacePoints     - Winning total points
 * @property {string} secondPlaceTeam      - Team name
 * @property {number} secondPlacePoints    - Runner-up total points
 * @property {string} highestAvgShooter    - Shooter name
 * @property {number} highestAvg           - Final average
 * @property {string|null} rookieOfYear    - Shooter name, or null if not awarded
 * @property {number|null} rookieAvg       - Rookie's final average
 * @property {string|null} mostImproved    - Shooter name, or null if not awarded
 * @property {string|null} improvement     - e.g. "51.79%" improvement string
 */

/**
 * Top shooter average by team (for the "Highest Average by Team" table).
 *
 * @typedef {Object} TeamTopShooter
 * @property {string} teamName     - Team name
 * @property {string} shooterName  - Shooter name
 * @property {number} average      - Final season average
 */

/**
 * A full season's metadata and summary.
 *
 * Firestore path: seasons/{year}
 *
 * @typedef {Object} Season
 * @property {string} id               - Firestore document ID (year as string, e.g. "2025")
 * @property {number} year             - Numeric year, e.g. 2025
 * @property {number} weekCount        - Total scheduled weeks (15, or 12 for 2020)
 * @property {string} startDate        - ISO 8601 date of first week
 * @property {string|null} endDate     - ISO 8601 date of final week; null if season in progress
 * @property {boolean} completed       - True once all weeks are finalized
 * @property {SeasonAwards|null} awards - End-of-season awards; null if season not completed
 * @property {TeamTopShooter[]} topShootersByTeam - Best avg per team (min 6 weeks shot)
 * @property {string[]} teamIds        - Ordered list of team document IDs for this season
 */
