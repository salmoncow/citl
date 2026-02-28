/**
 * CSV Parser — Season Data Importer
 *
 * Parses inputs.csv text into a SeasonData object matching the shape of
 * src/data/scorecards/*.json.
 *
 * Column layout (0-indexed):
 *   Col 0:  Team name (appears on first row of team group; carry-forward)
 *   Col 1:  Shooter name ("DUMMY" anywhere = dummy shooter)
 *   Col 2:  "R" = rookie, blank = not rookie
 *   Col 3:  W0 = starting average
 *   Col 4:  W1 score  ("-" or "" = did not shoot → null)
 *   ...
 *   Col 18: W15 score
 *   Cols 19-23: W16-W20 (unused, ignored)
 *   Col 24: F (unused, ignored)
 *   Col 25: Weeks Shot (pre-computed; ignored — engine recomputes)
 *   Col 26: Final Avg   (pre-computed; ignored — engine recomputes)
 *
 * Special rows skipped:
 *   - Blank rows (col 0 and col 1 both empty or "-")
 *   - Header row (col 3 === "W0")
 *   - Rows where col 1 is: TOTAL TARGETS, RANK POINTS, BONUS POINTS, YARDLINE
 *
 * @see src/services/scoring-engine.js for computed values
 * @see .specs/features/scoring-engine.md for full business rules
 */

const SKIP_NAMES = new Set(['TOTAL TARGETS', 'RANK POINTS', 'BONUS POINTS', 'YARDLINE']);
const SCORE_COLS = 15; // W1–W15 occupy cols 4–18

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse a single CSV line respecting quoted fields.
 * Handles simple comma-separated values; quotes are stripped.
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Convert a score field value to a number or null.
 * "-", "", whitespace-only → null (did not shoot).
 * Any numeric string → number.
 * @param {string} raw
 * @returns {number|null}
 */
function parseScore(raw) {
  const s = raw.trim();
  if (s === '' || s === '-' || s === '0') return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse inputs.csv text → SeasonData (matches src/types/scorecard.js shape).
 *
 * - Does NOT compute totals (scoring-engine.js does that)
 * - Sets shooter.isDummy = name.toUpperCase().includes('DUMMY')
 * - scores[] contains W1–W15 only (15 elements, 0-indexed → W1=0, W15=14)
 * - Carries forward team name until next non-blank col-0 entry
 *
 * @param {string} csvText  full text content of {year}-inputs.csv
 * @param {number} year     season year, e.g. 2025
 * @returns {import('../types/scorecard.js').SeasonData}
 */
export function parseSeasonCsv(csvText, year) {
  const lines = csvText.split(/\r?\n/);

  /** @type {import('../types/scorecard.js').Team[]} */
  const teams = [];

  let currentTeamName = '';
  let currentTeam = null;

  for (const line of lines) {
    if (!line.trim()) continue; // completely blank line

    const cols = parseCsvLine(line);

    // Column values
    const col0 = (cols[0] || '').trim();   // team name (or empty)
    const col1 = (cols[1] || '').trim();   // shooter name (or special row label)
    const col2 = (cols[2] || '').trim();   // "R" or ""
    const col3 = (cols[3] || '').trim();   // W0 / starting avg

    // Skip header row (col3 === "W0")
    if (col3 === 'W0') continue;

    // Skip special aggregate rows
    if (SKIP_NAMES.has(col1)) continue;

    // Skip blank data rows (no team name carry-over, no shooter name)
    if (col0 === '' && col1 === '') continue;

    // Update current team name if a new one appears in col0
    if (col0 !== '') {
      currentTeamName = col0;

      // Start a new team object
      currentTeam = {
        name: currentTeamName,
        shooters: [],
        totals: {
          targets:     new Array(SCORE_COLS).fill(null),
          rankPoints:  new Array(SCORE_COLS).fill(null),
          bonusPoints: new Array(SCORE_COLS).fill(null),
        },
      };
      teams.push(currentTeam);
    }

    // Must have a shooter name to add a shooter row
    if (col1 === '') continue;
    if (!currentTeam) continue; // safety — should not happen in well-formed CSV

    // Parse starting average
    const startingAvg = parseScore(col3) ?? 0;

    // Parse W1–W15 scores (cols 4–18)
    /** @type {(number|null)[]} */
    const scores = [];
    for (let c = 4; c < 4 + SCORE_COLS; c++) {
      scores.push(parseScore(cols[c] || ''));
    }

    const isDummy = col1.toUpperCase().includes('DUMMY');
    const rookie = col2.toUpperCase() === 'R' && !isDummy;

    /** @type {import('../types/scorecard.js').Shooter & { isDummy: boolean }} */
    const shooter = {
      name: col1,
      rookie,
      isDummy,
      startingAvg,
      scores,
      weeksShot: null, // computed by engine or left for display layer
      finalAvg: startingAvg, // default; engine recomputes
    };

    currentTeam.shooters.push(shooter);
  }

  return { season: year, teams };
}
