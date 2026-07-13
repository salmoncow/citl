/**
 * standings.ts — the canonical season-standings derivation (spec 005)
 *
 * Model: the `entries` collection is the single editable ledger; week docs
 * and `season.standings` are derived, published snapshots of it. Publishing
 * any week rebuilds EVERY already-published week doc from one engine pass
 * (`buildWeekResults`) and derives `season.standings` from the exact docs in
 * the same write batch — so
 *
 *   season.standings === computeStandingsFromWeeks(stored week docs)
 *
 * holds by construction, not by policing. `deleteTeam` patches week docs and
 * re-derives with the same function; `home-standings.ts` imports it for the
 * historical-week view. There is deliberately no second derivation anywhere
 * in src/ — see .specs/features/005-standings-unification/ (DD-1–DD-6; moves
 * to features/archive/ at close-out).
 *
 * Import rule: only @/types/* and @/services/scoring-engine.
 */

import {
  compareStandings,
  computeAccolades,
  normalizeShooterName,
} from '@/services/scoring-engine';
import type { SeasonEntry, ShooterScore, WeekResult } from '@/types/score';
import type { SeasonData } from '@/types/scorecard';
import type { SeasonStandings } from '@/types/season';

/**
 * THE canonical standings derivation: sum the stored per-week TeamResult
 * values, order by compareStandings, and rank 1..n.
 *
 * `throughWeek` (optional) limits the sum to weeks <= throughWeek — used by
 * the home page's historical-week view; omitted = all weeks (publish and
 * deleteTeam paths). Weeks absent from `weekResults` (never published, or a
 * gap) contribute nothing, by definition.
 */
export function computeStandingsFromWeeks(
  weekResults: WeekResult[],
  throughWeek?: number,
): SeasonStandings[] {
  const acc = new Map<string, { teamId: string; teamName: string; rankPoints: number; bonusPoints: number; targets: number }>();
  for (const wr of weekResults) {
    if (throughWeek !== undefined && wr.weekNumber > throughWeek) continue;
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

export interface PublishRewritePlan {
  /** Weeks to rebuild from the ledger: the published week ∪ stored weeks with entries. */
  weekNumbers: number[];
  /** First-publication timestamp of each stored doc, for preservation (DD-3). */
  publishedAtByWeek: Map<number, string>;
  /**
   * Stored docs the ledger cannot reproduce (no entries — pre-ledger imports,
   * e.g. migrated seasons): preserved verbatim, summed into standings.
   */
  preservedWeeks: WeekResult[];
}

/**
 * Decide which stored week docs a publish rewrites (spec 005 DD-2, amended
 * 2026-07-13): the published week plus every stored week <= maxWeek that the
 * entries ledger covers. A stored week with no entries CANNOT be regenerated
 * — rewriting it would wipe it to no-show zeros — so it is preserved instead.
 * Never-published weeks stay unpublished (gaps stay gaps).
 */
export function planPublishRewrite(opts: {
  publishWeekNumber: number;
  maxWeek: number;
  storedWeeks: WeekResult[];
  entries: SeasonEntry[];
}): PublishRewritePlan {
  const { publishWeekNumber, maxWeek, storedWeeks, entries } = opts;
  const publishedAtByWeek = new Map(storedWeeks.map((w) => [w.weekNumber, w.publishedAt]));
  const enteredWeeks = new Set(entries.map((e) => e.weekNumber));
  const weekNumbers = [
    ...new Set(
      [publishWeekNumber, ...publishedAtByWeek.keys()].filter(
        (w) => w <= maxWeek && (w === publishWeekNumber || enteredWeeks.has(w)),
      ),
    ),
  ].sort((a, b) => a - b);
  const rewritten = new Set(weekNumbers);
  return {
    weekNumbers,
    publishedAtByWeek,
    preservedWeeks: storedWeeks.filter((w) => !rewritten.has(w.weekNumber)),
  };
}

export interface BuildWeekResultsInput {
  /** Engine pass output: computeSeasonTotals(buildSeasonData(...)). */
  computed: SeasonData;
  /** The entries ledger for weeks <= maxWeek (already fetched by the caller). */
  entries: SeasonEntry[];
  /** Stable team-document-id resolver (F-08). */
  resolveTeamId: (name: string) => string;
  /** Which week docs to build — the rewrite set (DD-2). */
  weekNumbers: number[];
  /**
   * publishedAt per week: preserved from the stored doc for rewrites, fresh
   * for the week being published (DD-3). Caller-supplied so this module stays
   * clock-free and deterministic.
   */
  getPublishedAt: (weekNumber: number) => string;
}

/**
 * Build complete WeekResult docs for the given weeks from one engine pass —
 * the publish pipeline's pure core (DD-3: "entries are the ledger; publish =
 * sync"). Every doc is a pure function of (computed, entries, resolver,
 * publishedAt): identical inputs reproduce identical docs, including
 * accolades, which are recomputed from the regenerated shooterScores.
 */
export function buildWeekResults(input: BuildWeekResultsInput): WeekResult[] {
  const { computed, entries, resolveTeamId, getPublishedAt } = input;

  return input.weekNumbers.map((weekNumber) => {
    const wi = weekNumber - 1;
    const teamResults = computed.teams.map((team) => {
      const teamEntry = entries.find(
        (e) => e.weekNumber === weekNumber && e.teamName === team.name,
      );
      // DNS shooters and auto-created dummy positions were given computed
      // dummy scores in buildSeasonData. Include all of them in shooterScores
      // (score1/score2 null = computed). Compare normalized so a
      // case/whitespace variant in the saved entry doesn't duplicate the
      // roster shooter here (F-51).
      const entryShooterNames = new Set(
        teamEntry?.shooters.map((s) => normalizeShooterName(s.name)) ?? [],
      );
      const extraScores: ShooterScore[] = team.shooters
        .filter((s) => !entryShooterNames.has(normalizeShooterName(s.name)) && s.scores[wi] !== null)
        .map((s) => ({ name: s.name, score1: null, score2: null, total: s.scores[wi] as number }));
      return {
        teamId: resolveTeamId(team.name),
        teamName: team.name,
        targets: team.totals.targets[wi] ?? 0,
        rankPoints: team.totals.rankPoints[wi] ?? 0,
        bonusPoints: team.totals.bonusPoints[wi] ?? 0,
        shooterScores: [...(teamEntry?.shooters ?? []), ...extraScores],
      };
    });

    return {
      weekNumber,
      publishedAt: getPublishedAt(weekNumber),
      teamResults,
      accolades: computeAccolades(teamResults),
    };
  });
}
