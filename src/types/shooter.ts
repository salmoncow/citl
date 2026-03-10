/**
 * @file Shooter type definitions
 */

/**
 * A single shooter on a team for one season.
 * Firestore path: seasons/{year}/teams/{teamId}/shooters/{shooterId}
 */
export interface Shooter {
  /** Firestore document ID (auto-generated) */
  id: string;
  /** Full name, e.g. "Greg Litchfield" */
  name: string;
  /** True if this was their first season */
  rookie: boolean;
  /** Starting average for handicap purposes */
  startingAvg: number;
  /** Season-end average; null if never shot */
  finalAvg: number | null;
  /** Number of weeks actually shot; null if zero */
  weeksShot: number | null;
  /** Array of 15 scores (W1–W15); null = did not shoot */
  scores: (number | null)[];
}

/**
 * Accolade for a shooter in a given week (e.g. 25-straight, 50-straight).
 * Stored as a sub-array on WeekResult; no separate Firestore collection.
 */
export interface Accolade {
  shooterName: string;
  teamName: string;
  streak: number;
}
