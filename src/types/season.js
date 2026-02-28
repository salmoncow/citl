/**
 * @file Season type definitions
 *
 * JSDoc typedefs for season-level data shapes.
 * No runtime code — for IDE support only.
 */

/**
 * Season-level trophy / award winners.
 * Populated at season end; embedded in the seasons/{year} document.
 *
 * @typedef {Object} SeasonAwards
 * @property {{ shooterName: string, teamName: string, avg: number }}       highestAvg   - Highest average shooter
 * @property {{ shooterName: string, teamName: string, avg: number }|null}  rookieOfYear - Rookie of the year; null if not awarded
 * @property {{ shooterName: string, teamName: string, improvement: string }|null} mostImproved - Most improved; null if not awarded
 */

/**
 * A single row in the embedded standings array on the season document.
 * Updated on each week publish for O(1) home page reads.
 *
 * @typedef {Object} SeasonStandings
 * @property {number} rank              - 1-based position
 * @property {string} teamId            - Firestore team document ID
 * @property {string} teamName          - Display name
 * @property {number} totalRankPoints   - Cumulative rank points
 * @property {number} totalBonusPoints  - Cumulative bonus points
 * @property {number} totalTargets      - Cumulative targets shot
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
 * @property {string}            id          - Firestore document ID (year as string, e.g. "2025")
 * @property {number}            year        - Numeric year, e.g. 2025
 * @property {'active'|'complete'} status    - Season status
 * @property {number}            currentWeek - Highest published week number
 * @property {SeasonStandings[]} standings   - Cumulative standings; updated on each week publish
 * @property {SeasonAwards|null} awards      - End-of-season awards; null if season not completed
 */
