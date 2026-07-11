/**
 * standings.ts — pure season-standings derivations (spec 003, DD-3)
 *
 * Owns BOTH server-side standings derivations, extracted verbatim from
 * score-service.ts (spec 003-service-decomposition, Group 4):
 *
 *   - computeStandings:            from freshly computed SeasonData
 *                                  (publishWeek path)
 *   - recomputeStandingsFromWeeks: by summing stored per-week TeamResult
 *                                  values (deleteTeam / roster-removal path)
 *
 * INVARIANT (DD-4): these two must produce identical rows for identical
 * season states. True unification (e.g. publish rewriting week docs so one
 * derivation feeds both stored representations) is a storage-model behavior
 * change deferred to its own spec — do not attempt it in a pure refactor.
 * A third, client-side cumulative sum lives in home-standings.ts for
 * historical week selection.
 *
 * Import rule: only @/types/* and @/services/scoring-engine.
 */

import { compareStandings } from '@/services/scoring-engine';
import type { WeekResult } from '@/types/score';
import type { SeasonData } from '@/types/scorecard';
import type { SeasonStandings } from '@/types/season';

/**
 * Recompute season standings by summing the stored per-week TeamResult values.
 * Used after team deletion — the deleted team is already absent from weekResults.
 */
export function recomputeStandingsFromWeeks(weekResults: WeekResult[]): SeasonStandings[] {
  const acc = new Map<string, { teamId: string; teamName: string; rankPoints: number; bonusPoints: number; targets: number }>();
  for (const wr of weekResults) {
    for (const tr of wr.teamResults ?? []) {
      const cur = acc.get(tr.teamId) ?? { teamId: tr.teamId, teamName: tr.teamName, rankPoints: 0, bonusPoints: 0, targets: 0 };
      acc.set(tr.teamId, {
        ...cur,
        rankPoints: cur.rankPoints + (tr.rankPoints ?? 0),
        bonusPoints: cur.bonusPoints + (tr.bonusPoints ?? 0),
        targets: cur.targets + (tr.targets ?? 0),
      });
    }
  }
  const rows = [...acc.values()].sort((a, b) =>
    compareStandings(
      { points: a.rankPoints + a.bonusPoints, targets: a.targets },
      { points: b.rankPoints + b.bonusPoints, targets: b.targets },
    ),
  );
  return rows.map((row, i) => ({
    rank: i + 1,
    teamId: row.teamId,
    teamName: row.teamName,
    totalRankPoints: row.rankPoints,
    totalBonusPoints: row.bonusPoints,
    totalTargets: row.targets,
  }));
}

export function computeStandings(
  computed: SeasonData,
  throughWeek: number,
  resolveTeamId: (name: string) => string,
): SeasonStandings[] {
  const rows = computed.teams.map((team) => {
    let totalRankPoints = 0;
    let totalBonusPoints = 0;
    let totalTargets = 0;

    for (let wi = 0; wi < throughWeek; wi++) {
      totalRankPoints += team.totals.rankPoints[wi] ?? 0;
      totalBonusPoints += team.totals.bonusPoints[wi] ?? 0;
      totalTargets += team.totals.targets[wi] ?? 0;
    }

    return {
      teamId: resolveTeamId(team.name),
      teamName: team.name,
      totalRankPoints,
      totalBonusPoints,
      totalTargets,
    };
  });

  rows.sort((a, b) =>
    compareStandings(
      { points: a.totalRankPoints + a.totalBonusPoints, targets: a.totalTargets },
      { points: b.totalRankPoints + b.totalBonusPoints, targets: b.totalTargets },
    ),
  );

  return rows.map((row, i) => ({ rank: i + 1, ...row }));
}
