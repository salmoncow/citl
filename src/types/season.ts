/**
 * @file Season type definitions
 */

/**
 * Season-level trophy / award winners.
 * Populated at season end; embedded in the seasons/{year} document.
 */
export interface SeasonAwards {
  highestAvg: { shooterName: string; teamName: string; avg: number };
  rookieOfYear: { shooterName: string; teamName: string; avg: number } | null;
  mostImproved: { shooterName: string; teamName: string; improvement: string } | null;
}

/**
 * Computed season awards returned by computeSeasonAwards().
 * Not the same shape as SeasonAwards (Firestore-stored).
 */
export interface ComputedAwards {
  firstPlaceTeam: string | null;
  firstPlacePoints: number | null;
  secondPlaceTeam: string | null;
  secondPlacePoints: number | null;
  highestAvgShooter: string | null;
  highestAvg: number | null;
  rookieOfYear: string | null;
  rookieAvg: number | null;
  mostImproved: string | null;
  improvement: string | null;
}

/**
 * A single row in the embedded standings array on the season document.
 * Updated on each week publish for O(1) home page reads.
 */
export interface SeasonStandings {
  rank: number;
  teamId: string;
  teamName: string;
  totalRankPoints: number;
  totalBonusPoints: number;
  totalTargets: number;
}

/**
 * Top shooter average by team (for the "Highest Average by Team" table).
 */
export interface TeamTopShooter {
  teamName: string;
  shooterName: string;
  average: number;
}

/**
 * A full season's metadata and summary.
 * Firestore path: seasons/{year}
 */
export interface Season {
  id: string;
  year: number;
  status: 'active' | 'complete';
  currentWeek: number;
  standings: SeasonStandings[];
  awards: SeasonAwards | null;
}
