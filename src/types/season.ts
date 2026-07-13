/**
 * @file Season type definitions
 */

/**
 * Season-level trophy / award winners, embedded in the seasons/{year} document.
 * Written at season end by the admin finalize flow; also the engine's return
 * shape (computeSeasonAwards) — one type end to end.
 *
 * FLAT shape by prod precedent: all seven historical seasons (2019–2025) store
 * exactly these ten fields, verified against prod 2026-07-12
 * (.specs/features/004-season-awards/spec.md §"Verified Production Evidence").
 * `improvement` is a pre-formatted percent string (e.g. "55.24%") by the same
 * precedent — changing it to a number would require migrating seven prod docs.
 * All fields nullable: placements are null when standings lack a rank-1/rank-2
 * row; shooter awards are null when no shooter meets eligibility.
 */
export interface SeasonAwards {
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
 * Minimal per-shooter facts computeSeasonAwards consumes. Adapted from the
 * published scorecard derivation by toAwardShooterInputs (scorecard-builder)
 * so trophies always agree with the public scorecards page.
 */
export interface AwardShooterInput {
  name: string;
  /** Not consumed by the engine today; retained for future per-award team attribution. */
  teamName: string;
  isDummy: boolean;
  rookie: boolean;
  /** Going-in (W0) average — numeric only; display-only '-' rows are excluded upstream. */
  startingAvg: number;
  /** 15 weekly scores (W1–W15); null = did not shoot. */
  scores: (number | null)[];
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
  /** Admin-set date overrides per shoot week.
   *  key:   weekNumber as string ("1"–"15")
   *  value: ISO date string (postponed date) | null (cancelled)
   */
  weekDateOverrides?: Partial<Record<string, string | null>>;
}
