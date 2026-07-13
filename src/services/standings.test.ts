/**
 * @file standings.test.ts
 * Unit tests for the canonical standings derivation (spec 005).
 *
 * The multi-week fixture runs the REAL engine pass (buildSeasonData →
 * computeSeasonTotals), so these tests pin the whole pure pipeline:
 * entries → engine pass → buildWeekResults → computeStandingsFromWeeks.
 */

import { describe, it, expect } from 'vitest';
import { buildWeekResults, computeStandingsFromWeeks } from './standings';
import { buildSeasonData } from './scorecard-builder';
import { computeSeasonTotals } from './scoring-engine';
import type { SeasonData } from '@/types/scorecard';
import type { SeasonEntry, Team, WeekResult } from '@/types/score';

// ---------------------------------------------------------------------------
// Fixture: two teams, weeks 1–3, engineered so ranks flip mid-season
// ---------------------------------------------------------------------------

function makeEntry(
  weekNumber: number,
  teamId: string,
  teamName: string,
  perShooterTotal: number,
): SeasonEntry {
  const s1 = Math.floor(perShooterTotal / 2);
  const s2 = perShooterTotal - s1;
  return {
    year: 2026,
    weekNumber,
    teamId,
    teamName,
    savedAt: '',
    shooters: ['A', 'B', 'C', 'D', 'E'].map((base) => ({
      name: `${teamName} ${base}`,
      score1: s1,
      score2: s2,
      total: perShooterTotal,
    })),
  };
}

function makeTeamDoc(entry: SeasonEntry): Team {
  return {
    id: entry.teamId,
    name: entry.teamName,
    captain: '',
    shooters: entry.shooters.map((s) => ({
      id: '',
      name: s.name,
      rookie: false,
      startingAvg: 35,
      finalAvg: null,
      weeksShot: null,
      scores: new Array<number | null>(15).fill(null),
    })),
    totals: { targets: [], rankPoints: [], bonusPoints: [] },
  };
}

/** Hawks outscore Doves in W1/W3; Doves take W2. */
const ENTRIES: SeasonEntry[] = [
  makeEntry(1, 'hawks', 'Hawks', 44),
  makeEntry(1, 'doves', 'Doves', 40),
  makeEntry(2, 'hawks', 'Hawks', 38),
  makeEntry(2, 'doves', 'Doves', 46),
  makeEntry(3, 'hawks', 'Hawks', 48),
  makeEntry(3, 'doves', 'Doves', 42),
];
const TEAMS: Team[] = [makeTeamDoc(ENTRIES[0]!), makeTeamDoc(ENTRIES[1]!)];
const TEAM_ID_BY_NAME = new Map(TEAMS.map((t) => [t.name, t.id]));
const resolveTeamId = (name: string): string => TEAM_ID_BY_NAME.get(name) ?? name;

function enginePass(entries: SeasonEntry[], maxWeek: number): SeasonData {
  return computeSeasonTotals(buildSeasonData(2026, TEAMS, entries, maxWeek));
}

function docsThrough(maxWeek: number): WeekResult[] {
  return buildWeekResults({
    computed: enginePass(ENTRIES, maxWeek),
    entries: ENTRIES,
    resolveTeamId,
    weekNumbers: Array.from({ length: maxWeek }, (_, i) => i + 1),
    getPublishedAt: (w) => `2026-05-0${w}T00:00:00.000Z`,
  });
}

// ---------------------------------------------------------------------------
// Equivalence pin (task 1.3): before its deletion, spec 003's entries-side
// computeStandings was run against this exact fixture and produced
// row-identical output to computeStandingsFromWeeks over docs built by
// buildWeekResults from the same engine pass, for every through-week
// (verified 2026-07-13, spec 005). The concrete values below are that shared
// output — the fixture documents why the entries-side derivation was
// redundant. Rank points 30/28 per week; bonuses: W1 both +5, W2 Doves +5,
// W3 Hawks +5 (going-in sums 175/175, 197.5/187.5, 205/215).
// ---------------------------------------------------------------------------

describe('computeStandingsFromWeeks (canonical) — pinned fixture values', () => {
  it('through W1: Hawks lead', () => {
    expect(computeStandingsFromWeeks(docsThrough(3), 1)).toEqual([
      { rank: 1, teamId: 'hawks', teamName: 'Hawks', totalRankPoints: 30, totalBonusPoints: 5, totalTargets: 220 },
      { rank: 2, teamId: 'doves', teamName: 'Doves', totalRankPoints: 28, totalBonusPoints: 5, totalTargets: 200 },
    ]);
  });

  it('through W2: Doves take the lead', () => {
    expect(computeStandingsFromWeeks(docsThrough(3), 2)).toEqual([
      { rank: 1, teamId: 'doves', teamName: 'Doves', totalRankPoints: 58, totalBonusPoints: 10, totalTargets: 430 },
      { rank: 2, teamId: 'hawks', teamName: 'Hawks', totalRankPoints: 58, totalBonusPoints: 5, totalTargets: 410 },
    ]);
  });

  it('through W3: Hawks retake it', () => {
    expect(computeStandingsFromWeeks(docsThrough(3), 3)).toEqual([
      { rank: 1, teamId: 'hawks', teamName: 'Hawks', totalRankPoints: 88, totalBonusPoints: 10, totalTargets: 650 },
      { rank: 2, teamId: 'doves', teamName: 'Doves', totalRankPoints: 86, totalBonusPoints: 10, totalTargets: 640 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// computeStandingsFromWeeks — cutoff semantics (task 1.5)
// ---------------------------------------------------------------------------

describe('computeStandingsFromWeeks', () => {
  it('sums all weeks when throughWeek is omitted', () => {
    const all = computeStandingsFromWeeks(docsThrough(3));
    const explicit = computeStandingsFromWeeks(docsThrough(3), 3);
    expect(all).toEqual(explicit);
  });

  it('throughWeek is an inclusive boundary', () => {
    const docs = docsThrough(3);
    const through2 = computeStandingsFromWeeks(docs, 2);
    const hawks = through2.find((r) => r.teamId === 'hawks')!;
    // Hawks W1: 5×44=220 targets; W2: 5×38=190. W3 (240) must be excluded.
    expect(hawks.totalTargets).toBe(410);
  });

  it('weeks absent from the input (gaps / never published) contribute nothing', () => {
    const docs = docsThrough(3).filter((w) => w.weekNumber !== 2);
    const hawks = computeStandingsFromWeeks(docs, 3).find((r) => r.teamId === 'hawks')!;
    expect(hawks.totalTargets).toBe(220 + 240); // W1 + W3 only
  });

  it('ranks by points with the targets tie-breaker and numbers 1..n', () => {
    const rows = computeStandingsFromWeeks(docsThrough(3));
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
    expect(rows[0]!.totalRankPoints + rows[0]!.totalBonusPoints)
      .toBeGreaterThanOrEqual(rows[1]!.totalRankPoints + rows[1]!.totalBonusPoints);
  });

  it('accumulates by teamId, so a renamed team stays one row (F-08 contract)', () => {
    const docs = docsThrough(2);
    // Simulate a rename recorded between W1 and W2: same teamId, new display name.
    docs[1]!.teamResults = docs[1]!.teamResults.map((tr) =>
      tr.teamId === 'hawks' ? { ...tr, teamName: 'Night Hawks' } : tr,
    );
    const rows = computeStandingsFromWeeks(docs);
    expect(rows.filter((r) => r.teamId === 'hawks')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// buildWeekResults — determinism + construction (task 1.5)
// ---------------------------------------------------------------------------

describe('buildWeekResults', () => {
  it('is deterministic: identical inputs reproduce identical docs, accolades included', () => {
    expect(docsThrough(3)).toEqual(docsThrough(3));
  });

  it('stamps each doc with the caller-supplied publishedAt', () => {
    const docs = docsThrough(2);
    expect(docs.map((d) => d.publishedAt)).toEqual([
      '2026-05-01T00:00:00.000Z',
      '2026-05-02T00:00:00.000Z',
    ]);
  });

  it('recomputes accolades from the regenerated shooterScores (DD-3)', () => {
    const entries = [
      makeEntry(1, 'hawks', 'Hawks', 40),
      { ...makeEntry(1, 'doves', 'Doves', 40),
        shooters: [
          { name: 'Doves A', score1: 25, score2: 25, total: 50 },
          { name: 'Doves B', score1: 25, score2: 20, total: 45 },
          { name: 'Doves C', score1: 20, score2: 20, total: 40 },
          { name: 'Doves D', score1: 20, score2: 20, total: 40 },
          { name: 'Doves E', score1: 20, score2: 20, total: 40 },
        ] },
    ];
    const [doc] = buildWeekResults({
      computed: enginePass(entries, 1),
      entries,
      resolveTeamId,
      weekNumbers: [1],
      getPublishedAt: () => 'x',
    });
    expect(doc!.accolades).toEqual([
      { shooterName: 'Doves A', teamName: 'Doves', streak: 50 },
      { shooterName: 'Doves B', teamName: 'Doves', streak: 25 },
    ]);
  });

  it('a week with no entry for a team still yields a row (no-show semantics preserved)', () => {
    const entries = [makeEntry(1, 'hawks', 'Hawks', 44)]; // Doves: no W1 entry
    const [doc] = buildWeekResults({
      computed: enginePass(entries, 1),
      entries,
      resolveTeamId,
      weekNumbers: [1],
      getPublishedAt: () => 'x',
    });
    const doves = doc!.teamResults.find((tr) => tr.teamId === 'doves')!;
    expect(doves.targets).toBe(0);
    expect(doves.shooterScores).toHaveLength(0);
  });
});
