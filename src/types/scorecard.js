/**
 * @file Scorecard type definitions
 *
 * JSDoc typedefs for historical scorecard display data.
 * These types describe the JSON structure in src/data/scorecards/*.json.
 *
 * No runtime code — for IDE support only.
 *
 * Note: These types are separate from the Firestore-backed types in score.js /
 * season.js / shooter.js. Scorecard JSON files are permanent static assets
 * (ADR-003) and are never replaced by Firestore data.
 */

/**
 * A single shooter's scorecard entry for a season.
 * Mirrors the object structure within each team's `shooters` array in the JSON.
 *
 * @typedef {Object} Shooter
 * @property {string}           name         - Full name, e.g. "Greg Litchfield"
 * @property {boolean}          rookie       - True if this was the shooter's first season
 * @property {number}           startingAvg  - Going-in average for handicap purposes
 * @property {(number|null)[]}  scores       - Array of 15 weekly scores (W1–W15); null = did not shoot
 * @property {number|null}      weeksShot    - Number of weeks actually shot; null if zero
 * @property {number}           finalAvg     - Season-end average (may equal startingAvg if never shot)
 */

/**
 * A team's aggregate totals for the season, stored as parallel arrays
 * indexed 0–14 (W1–W15). null indicates the team did not shoot that week.
 *
 * @typedef {Object} TeamTotals
 * @property {(number|null)[]}  targets      - Total targets broken by the team per week (15 elements)
 * @property {(number|null)[]}  rankPoints   - Rank points earned by the team per week (15 elements)
 * @property {(number|null)[]}  bonusPoints  - Bonus points earned by the team per week (15 elements)
 */

/**
 * A single team's full scorecard data for one season.
 *
 * @typedef {Object} Team
 * @property {string}      name      - Team name, e.g. "Bullshooters"
 * @property {Shooter[]}   shooters  - All shooters on the team (including those who never shot)
 * @property {TeamTotals}  totals    - Parallel arrays of team-level weekly totals
 */

/**
 * The complete scorecard data for one season, as stored in
 * src/data/scorecards/{year}.json.
 *
 * @typedef {Object} SeasonData
 * @property {number}  season  - The season year, e.g. 2025
 * @property {Team[]}  teams   - All teams in the season
 */
