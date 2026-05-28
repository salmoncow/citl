/**
 * @file Scorecard type definitions
 *
 * Types for scorecard display data. Used by scoring-engine and score-service
 * to describe the SeasonData shape computed from Firestore.
 */

/**
 * A single shooter's scorecard entry for a season.
 * Used by the scoring engine (startingAvg is always numeric here).
 */
export interface ScorecardShooter {
  name: string;
  rookie: boolean;
  /** True if name contains "DUMMY" (case-insensitive) */
  isDummy?: boolean;
  /** Going-in average for handicap purposes */
  startingAvg: number;
  /** Array of 15 weekly scores (W1–W15); null = did not shoot */
  scores: (number | null)[];
  /** Number of weeks actually shot; null if zero */
  weeksShot: number | null;
  /** Season-end average (may equal startingAvg if never shot) */
  finalAvg: number;
}

/**
 * A team's aggregate totals for the season, stored as parallel arrays
 * indexed 0–14 (W1–W15). null indicates the team did not shoot that week.
 */
export interface TeamTotals {
  targets: (number | null)[];
  rankPoints: (number | null)[];
  bonusPoints: (number | null)[];
}

/**
 * A single team's full scorecard data for one season.
 */
export interface Team {
  name: string;
  shooters: ScorecardShooter[];
  totals: TeamTotals;
}

/**
 * The complete scorecard data for one season.
 */
export interface SeasonData {
  season: number;
  teams: Team[];
}

/**
 * A single shooter row, fully computed and ready to render in the
 * season-scorecards view. Built by ScoreService.buildScorecardData.
 */
export interface ScorecardRowShooter {
  name: string;
  rookie: boolean;
  isDummy: boolean;
  /** Display value for the W0 column: prior avg, dummy display, or '-' when unknown. */
  w0Display: number | '-';
  /** 15 weekly scores (W1–W15); null = did not shoot. */
  scores: (number | null)[];
  /** Number of weeks actually shot; null when zero. */
  weeksShot: number | null;
  /** Display value for the season-average column. */
  finalAvg: number | string;
}

/**
 * A team block ready to render. Shooters are pre-sorted: captain first
 * among real shooters, dummies last.
 */
export interface ScorecardTeamBlock {
  teamName: string;
  shooters: ScorecardRowShooter[];
  targets: (number | null)[];
  rankPoints: (number | null)[];
  bonusPoints: (number | null)[];
}

/**
 * Aggregate scorecard view data for one season.
 */
export interface ScorecardViewData {
  year: number;
  teams: ScorecardTeamBlock[];
}
