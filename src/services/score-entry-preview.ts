/**
 * score-entry-preview — the admin "live calculation" panel (spec 006 DD-12).
 *
 * Composes existing engine functions only — no new scoring logic. It runs
 * the same pass publish runs (computeSeasonTotals over buildSeasonData) with
 * this team's week-N entry replaced by the on-screen draft, then reads the
 * team's going-in sum, target bonus, rookie bonus and yardage. Inputs are
 * data the Score Entry tab already holds, so it costs no reads.
 */

import { buildSeasonData } from '@/services/scorecard-builder';
import {
  computeGoingInAverage,
  computeGoingInAverageSum,
  computeRookieBonus,
  computeSeasonTotals,
  computeTargetBonus,
  normalizeShooterName,
} from '@/services/scoring-engine';
import { lookupYardage, type YardageRow } from '@/utils/yardage';
import type { SeasonEntry, Team } from '@/types/score';

const ROOKIE_BONUS_LAST_WEEK = 10;

export interface RookieNote {
  name: string;
  goingIn: number;
  qualifies: boolean;
}

export interface TeamNightPreview {
  teamTotal: number;
  shootersCounted: number;
  goingInSum: number;
  targetBonus: number;
  rookieBonus: number;
  rookieNotes: RookieNote[];
  /** No rookie points are awarded after week 10 (rule 5.6b). */
  rookieWindowClosed: boolean;
  yardage: YardageRow | null;
  /** Going-in average per shooter (normalized name → average), all roster rows. */
  goingInByName: Map<string, number>;
}

export function previewTeamNight(opts: {
  year: number;
  weekNumber: number;
  teams: Team[];
  /** Saved entries for weeks ≤ weekNumber (any teams). */
  entries: SeasonEntry[];
  /** The on-screen draft for this team and week. */
  draft: SeasonEntry;
}): TeamNightPreview | null {
  const { year, weekNumber, teams, entries, draft } = opts;
  const wi = weekNumber - 1;
  const merged = [
    ...entries.filter((e) => !(e.teamName === draft.teamName && e.weekNumber === weekNumber)),
    draft,
  ];
  const season = computeSeasonTotals(buildSeasonData(year, teams, merged, weekNumber));
  const team = season.teams.find((t) => t.name === draft.teamName);
  if (!team) return null;

  const goingInSum = computeGoingInAverageSum(team.shooters, wi);
  const teamTotal = team.totals.targets[wi] ?? 0;
  const rookieWindowClosed = wi >= ROOKIE_BONUS_LAST_WEEK;

  const rookieNotes = team.shooters
    .filter((s) => s.rookie && !s.isDummy && s.scores[wi] != null)
    .map((s) => {
      const goingIn = computeGoingInAverage(s.startingAvg, s.scores, wi);
      return { name: s.name, goingIn, qualifies: goingIn < 35 && !rookieWindowClosed };
    });

  const goingInByName = new Map(
    team.shooters.map((s) => [normalizeShooterName(s.name), computeGoingInAverage(s.startingAvg, s.scores, wi)]),
  );

  return {
    teamTotal,
    shootersCounted: team.shooters.filter((s) => s.scores[wi] != null).length,
    goingInSum,
    targetBonus: computeTargetBonus(teamTotal, goingInSum) ?? 0,
    rookieBonus: computeRookieBonus(team.shooters, wi),
    rookieNotes,
    rookieWindowClosed,
    yardage: lookupYardage(goingInSum),
    goingInByName,
  };
}
