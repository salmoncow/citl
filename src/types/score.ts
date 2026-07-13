/**
 * @file Score / standings type definitions
 */

import type { Shooter, Accolade } from './shooter';

/**
 * A team's cumulative totals across all weeks shot so far.
 * Stored as parallel arrays indexed 0–14 (W1–W15); null = week not played.
 */
export interface TeamTotals {
  targets: (number | null)[];
  rankPoints: (number | null)[];
  bonusPoints: (number | null)[];
}

/**
 * A single team's data within a season.
 * Firestore path: seasons/{year}/teams/{teamId}
 */
export interface Team {
  id: string;
  name: string;
  captain: string;
  shooters: Shooter[];
  totals: TeamTotals;
}

/**
 * A single shooter's score for one week, embedded in a TeamResult.
 */
export interface ShooterScore {
  name: string;
  /** Round 1 score (0–25); null for historical imports */
  score1: number | null;
  /** Round 2 score (0–25); null for historical imports */
  score2: number | null;
  /** Combined score */
  total: number;
}

/**
 * A single team's computed results for one week, embedded in a WeekResult.
 */
export interface TeamResult {
  teamId: string;
  teamName: string;
  targets: number;
  rankPoints: number;
  bonusPoints: number;
  shooterScores: ShooterScore[];
}

/**
 * The full computed results for a single week within a season.
 * Firestore path: seasons/{year}/weeks/{weekNumber}
 */
export interface WeekResult {
  weekNumber: number;
  publishedAt: string;
  teamResults: TeamResult[];
  accolades?: Accolade[];
}

/**
 * Raw admin score entry — audit trail before publish.
 * Firestore path: seasons/{year}/entries/{weekNumber}_{teamId}
 */
export interface SeasonEntry {
  year: number;
  weekNumber: number;
  teamId: string;
  teamName: string;
  savedAt: string;
  shooters: ShooterScore[];
}
