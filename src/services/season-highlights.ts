/**
 * season-highlights — pure derivations for the home page's stat tiles and
 * award-race cards (spec 006). No I/O: callers pass data already loaded by
 * ScoreService (published week results + scorecard blocks), so these add
 * zero Firestore reads.
 *
 * Award races follow the same shooter rules as computeSeasonAwards
 * (dummies excluded, full-precision current average), but rank everyone
 * who has shot at least MIN_RACE_NIGHTS so the race is visible mid-season;
 * each row reports whether it already meets the 6-night award eligibility.
 */

import {
  computeAccolades,
  computeMostImprovedScore,
  computeShooterAverage,
  isDummyName,
} from '@/services/scoring-engine';
import type { WeekResult } from '@/types/score';
import type { AwardShooterInput } from '@/types/season';

/** Nights required for individual awards (rules §6.3). */
export const AWARD_MIN_NIGHTS = 6;
/** Nights after which the starting average drops out (rules §5.1). */
export const MIN_RACE_NIGHTS = 2;

const WEEK_COUNT = 15;

export interface RaceEntry {
  name: string;
  teamName: string;
  /** Current average, or Most Improved score (%) for the improvement race. */
  value: number;
  nights: number;
  eligible: boolean;
}

export interface AwardRaces {
  topGun: RaceEntry[];
  rookie: RaceEntry[];
  mostImproved: RaceEntry[];
}

/** Rank the three individual award races; each list is best-first, `limit` long. */
export function computeAwardRaces(shooters: AwardShooterInput[], limit = 3): AwardRaces {
  const lines = shooters
    .filter((s) => !s.isDummy)
    .map((s) => {
      const nights = s.scores.filter((v) => v !== null).length;
      const avg = computeShooterAverage(s.startingAvg, s.scores, WEEK_COUNT - 1);
      return { s, nights, avg, improvement: computeMostImprovedScore(s.startingAvg, avg) };
    })
    .filter((l) => l.nights >= MIN_RACE_NIGHTS);

  const toEntry = (l: (typeof lines)[number], value: number): RaceEntry => ({
    name: l.s.name,
    teamName: l.s.teamName,
    value,
    nights: l.nights,
    eligible: l.nights >= AWARD_MIN_NIGHTS,
  });

  const byAvg = [...lines].sort((a, b) => b.avg - a.avg || a.s.name.localeCompare(b.s.name));
  const byImprovement = [...lines].sort(
    (a, b) => b.improvement - a.improvement || a.s.name.localeCompare(b.s.name),
  );

  return {
    topGun: byAvg.slice(0, limit).map((l) => toEntry(l, l.avg)),
    rookie: byAvg.filter((l) => l.s.rookie).slice(0, limit).map((l) => toEntry(l, l.avg)),
    mostImproved: byImprovement.slice(0, limit).map((l) => toEntry(l, l.improvement)),
  };
}

/**
 * League average per shooter per night (targets of 50), by published week.
 * Uses each row's `total` — the same value the scorecards display (historical
 * imports carry totals without per-bunker scores). Dummies are excluded;
 * weeks with no qualifying rows are omitted.
 */
export function computeLeagueAverageByWeek(
  weeks: WeekResult[],
): { weekNumber: number; average: number }[] {
  const out: { weekNumber: number; average: number }[] = [];
  const sorted = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  for (const wr of sorted) {
    const totals: number[] = [];
    for (const tr of wr.teamResults ?? []) {
      for (const s of tr.shooterScores ?? []) {
        if (isDummyName(s.name) || typeof s.total !== 'number') continue;
        totals.push(s.total);
      }
    }
    if (totals.length === 0) continue;
    out.push({ weekNumber: wr.weekNumber, average: totals.reduce((a, b) => a + b, 0) / totals.length });
  }
  return out;
}

export interface ShooterAverage {
  name: string;
  teamName: string;
  average: number;
  nights: number;
}

/**
 * Current shooter averages straight from published week docs, best first.
 * Only shooters with >= MIN_RACE_NIGHTS nights are included: from the second
 * night on, the starting average has phased out (rules §5.1), so the plain
 * mean of their totals IS their league average — no prior-season reads
 * needed. Rows are keyed by team + name, matching the scorecards.
 */
export function computeCurrentAverages(weeks: WeekResult[]): ShooterAverage[] {
  const acc = new Map<string, { name: string; teamName: string; sum: number; nights: number }>();
  for (const wr of weeks) {
    for (const tr of wr.teamResults ?? []) {
      for (const s of tr.shooterScores ?? []) {
        if (isDummyName(s.name) || typeof s.total !== 'number') continue;
        const key = `${tr.teamName}\u0000${s.name}`;
        const cur = acc.get(key) ?? { name: s.name, teamName: tr.teamName, sum: 0, nights: 0 };
        cur.sum += s.total;
        cur.nights += 1;
        acc.set(key, cur);
      }
    }
  }
  return [...acc.values()]
    .filter((a) => a.nights >= MIN_RACE_NIGHTS)
    .map((a) => ({ name: a.name, teamName: a.teamName, average: a.sum / a.nights, nights: a.nights }))
    .sort((a, b) => b.average - a.average || a.name.localeCompare(b.name));
}

/**
 * Season count of perfect bunkers. A straight 50 is two perfect bunkers,
 * so `straight25s` counts every 25-for-25 round, including those inside 50s.
 */
export function countStraights(weeks: WeekResult[]): { straight25s: number; straight50s: number } {
  let straight25s = 0;
  let straight50s = 0;
  for (const wr of weeks) {
    for (const a of computeAccolades(wr.teamResults ?? [])) {
      if (a.streak === 50) {
        straight50s += 1;
        straight25s += 2;
      } else {
        straight25s += 1;
      }
    }
  }
  return { straight25s, straight50s };
}
