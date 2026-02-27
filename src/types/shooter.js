/**
 * @file Shooter type definitions
 *
 * JSDoc typedefs for shooter data shapes.
 * No runtime code — for IDE support only.
 */

/**
 * A single shooter on a team for one season.
 *
 * Firestore path: seasons/{year}/teams/{teamId}/shooters/{shooterId}
 *
 * @typedef {Object} Shooter
 * @property {string} id           - Firestore document ID (auto-generated)
 * @property {string} name         - Full name, e.g. "Greg Litchfield"
 * @property {boolean} rookie      - True if this was their first season
 * @property {number} startingAvg  - Starting average for handicap purposes
 * @property {number|null} finalAvg - Season-end average; null if never shot
 * @property {number|null} weeksShot - Number of weeks actually shot; null if zero
 * @property {(number|null)[]} scores - Array of 15 scores (W1–W15); null = did not shoot
 */

/**
 * Accolade for a shooter in a given week (e.g. 25-straight, 50-straight).
 *
 * Stored as a sub-array on WeekResult; no separate Firestore collection.
 *
 * @typedef {Object} Accolade
 * @property {string} shooterName  - Shooter's full name
 * @property {string} teamName     - Team name
 * @property {number} streak       - Consecutive targets broken (25, 50, 75, 100…)
 */
