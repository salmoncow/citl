/**
 * @file Score / standings type definitions
 *
 * JSDoc typedefs for team score and standings data shapes.
 * No runtime code — for IDE support only.
 */

/**
 * A team's cumulative totals across all weeks shot so far.
 * Stored as parallel arrays indexed 0–14 (W1–W15); null = week not played.
 *
 * @typedef {Object} TeamTotals
 * @property {(number|null)[]} targets      - Team targets shot per week (15 elements)
 * @property {(number|null)[]} rankPoints   - Rank points earned per week (15 elements)
 * @property {(number|null)[]} bonusPoints  - Bonus points earned per week (15 elements)
 */

/**
 * A single team's data within a season.
 *
 * Firestore path: seasons/{year}/teams/{teamId}
 *
 * @typedef {Object} Team
 * @property {string} id           - Firestore document ID
 * @property {string} name         - Team name, e.g. "Bullshooters"
 * @property {string} captain      - Captain's full name
 * @property {import('./shooter.js').Shooter[]} shooters - All shooters on this team
 * @property {TeamTotals} totals   - Parallel arrays for targets/rank/bonus per week
 */

/**
 * A team's standing at the end of a specific week.
 * Derived/computed — not stored directly in Firestore.
 *
 * @typedef {Object} StandingRow
 * @property {number} standing     - 1-based rank position
 * @property {string} teamId       - Firestore team document ID
 * @property {string} teamName     - Display name
 * @property {string} captain      - Captain's full name
 * @property {number} weekTargets  - Targets shot this week
 * @property {number} totalTargets - Season cumulative targets
 * @property {number} rankPoints   - Rank points earned this week
 * @property {number} bonusPoints  - Bonus points earned this week
 * @property {number} totalPoints  - Season cumulative total points (rank + bonus)
 */

/**
 * The full results for a single week within a season.
 *
 * Firestore path: seasons/{year}/weeks/{weekNumber}
 *
 * @typedef {Object} WeekResult
 * @property {string} id               - Firestore document ID (same as weekNumber as string)
 * @property {number} weekNumber       - 1–15
 * @property {string} updatedAt        - ISO 8601 date string of last update
 * @property {import('./shooter.js').Accolade[]} accolades - Notable straights this week
 * @property {StandingRow[]} standings - Sorted standings snapshot for this week
 */
