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
 * A single shooter's score for one week, embedded in a TeamResult.
 *
 * @typedef {Object} ShooterScore
 * @property {string}      name    - Shooter full name
 * @property {number|null} score1  - Round 1 score (0–25); null for historical imports
 * @property {number|null} score2  - Round 2 score (0–25); null for historical imports
 * @property {number}      total   - Combined score (score1 + score2, or total directly for historical)
 */

/**
 * A single team's computed results for one week, embedded in a WeekResult.
 *
 * @typedef {Object} TeamResult
 * @property {string}         teamId        - Firestore team document ID
 * @property {string}         teamName      - Display name
 * @property {number}         targets       - Total targets shot this week
 * @property {number}         rankPoints    - Rank points awarded this week
 * @property {number}         bonusPoints   - Combined target + rookie bonus
 * @property {ShooterScore[]} shooterScores - Individual shooter scores
 */

/**
 * The full computed results for a single week within a season.
 *
 * Firestore path: seasons/{year}/weeks/{weekNumber}
 *
 * @typedef {Object} WeekResult
 * @property {number}       weekNumber   - 1–15
 * @property {string}       publishedAt  - ISO 8601 timestamp of publish
 * @property {TeamResult[]} teamResults  - All teams in one document
 */

/**
 * Raw admin score entry — audit trail before publish.
 *
 * Firestore path: seasons/{year}/entries/{weekNumber}_{teamId}
 *
 * @typedef {Object} SeasonEntry
 * @property {number}         year        - e.g. 2025
 * @property {number}         weekNumber  - 1–15
 * @property {string}         teamId      - Firestore team document ID
 * @property {string}         teamName    - Display name
 * @property {string}         savedAt     - ISO 8601 timestamp
 * @property {ShooterScore[]} shooters    - Raw shooter scores as entered
 */
