/**
 * scorecard-builder.ts — pure scorecard assembly (spec 003, DD-3 sibling)
 *
 * Builds SeasonData and per-team scorecard blocks from already-fetched
 * Firestore documents. Pure: no I/O, no caching — extracted verbatim from
 * score-service.ts (spec 003-service-decomposition, Group 4).
 *
 * Import rule (scoring-engine convention): only @/types/* and
 * @/services/scoring-engine — never score-service or repositories.
 */

import { computeDummyScore, computeShooterAverage, computeShooterStartingAvg, getLastWord, isDummyName, isShooterRookie, mean, normalizeShooterName, sortShootersWithCaptainFirst } from '@/services/scoring-engine';
import type { Team, WeekResult, SeasonEntry } from '@/types/score';
import type { SeasonData, ScorecardShooter, ScorecardRowShooter, ScorecardTeamBlock } from '@/types/scorecard';

export function buildSeasonData(
  year: number,
  firestoreTeams: Team[],
  entries: SeasonEntry[],
  maxWeek: number,
): SeasonData {
  const WEEK_COUNT = 15;

  const entryMap = new Map<string, Map<number, SeasonEntry>>();
  for (const entry of entries) {
    if (!entryMap.has(entry.teamName)) entryMap.set(entry.teamName, new Map());
    entryMap.get(entry.teamName)!.set(entry.weekNumber, entry);
  }

  const teams = firestoreTeams.map((firestoreTeam) => {
    const teamEntries = entryMap.get(firestoreTeam.name) ?? new Map<number, SeasonEntry>();

    // Track entry shooters by normalized name (display spelling as the value)
    // so a case/whitespace variant of a rostered shooter never spawns a
    // phantom substitute row with a fresh 35 average (F-51).
    const seenNames = new Map<string, string>();
    for (const [wn, entry] of teamEntries) {
      if (wn > maxWeek) continue;
      for (const s of entry.shooters) seenNames.set(normalizeShooterName(s.name), s.name);
    }

    const rosterShooters: ScorecardShooter[] = (firestoreTeam.shooters ?? []).map((rs) => {
      seenNames.delete(normalizeShooterName(rs.name));
      return {
        name: rs.name,
        rookie: rs.rookie ?? false,
        isDummy: isDummyName(rs.name),
        startingAvg: rs.startingAvg ?? 35,
        scores: new Array<number | null>(WEEK_COUNT).fill(null),
        weeksShot: null,
        finalAvg: 0,
      };
    });

    const subShooters: ScorecardShooter[] = [...seenNames.values()].map((name) => ({
      name,
      rookie: false,
      isDummy: isDummyName(name),
      startingAvg: 35,
      scores: new Array<number | null>(WEEK_COUNT).fill(null),
      weeksShot: null,
      finalAvg: 0,
    }));

    const shooters = [...rosterShooters, ...subShooters];

    for (let wn = 1; wn <= maxWeek; wn++) {
      const entry = teamEntries.get(wn);
      if (!entry) continue;
      const wi = wn - 1;
      for (const entryShooter of entry.shooters) {
        const entryKey = normalizeShooterName(entryShooter.name);
        const shooter = shooters.find((s) => normalizeShooterName(s.name) === entryKey);
        if (shooter) shooter.scores[wi] = entryShooter.total;
      }

      // Compute dummy score: mean of real shooters' actual scores that night, minus 5.
      const realScores = shooters
        .filter((s) => !s.isDummy && s.scores[wi] !== null)
        .map((s) => s.scores[wi] as number);
      const dummyScore = computeDummyScore(realScores);
      if (dummyScore === null) continue; // no real shooters shot this week → nothing to fill

      // Dummy positions pass: a team always fields 5 scoring slots per week.
      // Create/fill auto-named DUMMY entries until total scored positions reaches 5.
      const scoredCount = shooters.filter((s) => s.scores[wi] !== null).length;
      const dummiesNeeded = Math.min(2, Math.max(0, 5 - scoredCount));
      if (dummiesNeeded > 0) {
        const prefix = getLastWord(firestoreTeam.name);
        let dummyNum = 0;
        let filled = 0;
        while (filled < dummiesNeeded && dummyNum < 10) {
          dummyNum++;
          const dName = `${prefix} DUMMY${dummyNum}`;
          let dummyShooter = shooters.find((s) => s.name === dName);
          if (!dummyShooter) {
            dummyShooter = {
              name: dName,
              rookie: false,
              isDummy: true,
              startingAvg: 35,
              scores: new Array<number | null>(WEEK_COUNT).fill(null),
              weeksShot: null,
              finalAvg: 0,
            };
            shooters.push(dummyShooter);
          }
          if (dummyShooter.scores[wi] === null) {
            dummyShooter.scores[wi] = dummyScore;
            filled++;
          }
        }
      }
    }

    return {
      name: firestoreTeam.name,
      shooters,
      totals: {
        targets: new Array<number | null>(WEEK_COUNT).fill(null),
        rankPoints: new Array<number | null>(WEEK_COUNT).fill(null),
        bonusPoints: new Array<number | null>(WEEK_COUNT).fill(null),
      },
    };
  });

  return { season: year, teams };
}

/**
 * Build one team block for the season-scorecards view. Pure given its inputs
 * (no I/O), so it can be unit-tested without a repository stub.
 */
export function buildScorecardTeamBlock(args: {
  teamName: string;
  teamDoc: Team | undefined;
  weekResults: WeekResult[];
  prior1Teams: Team[];
  prior2Teams: Team[];
  prior1AvgMap: Map<string, number>;
  prior2AvgMap: Map<string, number>;
}): ScorecardTeamBlock {
  const { teamName, teamDoc, weekResults, prior1Teams, prior2Teams, prior1AvgMap, prior2AvgMap } = args;
  const WEEK_COUNT = 15;

  interface ShooterState {
    name: string;
    rookie: boolean;
    isDummy: boolean;
    startingAvg: number | '-';
    scores: (number | null)[];
    w0Display?: number;
  }

  const shooterMap = new Map<string, ShooterState>();

  if (teamDoc?.shooters?.length) {
    for (const s of teamDoc.shooters) {
      const key = normalizeShooterName(s.name);
      const computedAvg = prior1AvgMap.get(key)
        ?? prior2AvgMap.get(key)
        ?? computeShooterStartingAvg(s.name, [...prior1Teams, ...prior2Teams]);
      const computedRookie = isShooterRookie(s.name, prior1Teams, prior2Teams, prior1AvgMap, prior2AvgMap);
      shooterMap.set(s.name, {
        name: s.name,
        rookie: computedRookie,
        isDummy: isDummyName(s.name),
        startingAvg: computedAvg,
        scores: new Array<number | null>(WEEK_COUNT).fill(null),
      });
    }
  }

  const targets: (number | null)[] = new Array(WEEK_COUNT).fill(null);
  const rankPoints: (number | null)[] = new Array(WEEK_COUNT).fill(null);
  const bonusPoints: (number | null)[] = new Array(WEEK_COUNT).fill(null);

  for (const wr of weekResults) {
    const wi = wr.weekNumber - 1;
    if (wi < 0 || wi >= WEEK_COUNT) continue;

    const teamResult = (wr.teamResults ?? []).find((tr) => tr.teamName === teamName);
    if (!teamResult) continue;

    targets[wi] = teamResult.targets ?? null;
    rankPoints[wi] = teamResult.rankPoints ?? null;
    bonusPoints[wi] = teamResult.bonusPoints ?? null;

    for (const ss of teamResult.shooterScores ?? []) {
      if (!shooterMap.has(ss.name)) {
        // Only re-add shooters not on the current roster if they are dummies.
        // Real shooters removed from the roster must not reappear via published data.
        if (!isDummyName(ss.name)) continue;
        shooterMap.set(ss.name, {
          name: ss.name,
          rookie: false,
          isDummy: true,
          startingAvg: '-',
          scores: new Array<number | null>(WEEK_COUNT).fill(null),
        });
      }
      shooterMap.get(ss.name)!.scores[wi] = ss.total ?? null;
    }
  }

  // Pad to 2 DUMMY placeholder rows per team
  const existingDummies = [...shooterMap.values()].filter((s) => s.isDummy);
  if (existingDummies.length < 2) {
    const prefix = getLastWord(teamName);
    for (let n = existingDummies.length + 1; n <= 2; n++) {
      const dName = `${prefix} DUMMY${n}`;
      if (!shooterMap.has(dName)) {
        shooterMap.set(dName, {
          name: dName,
          rookie: false,
          isDummy: true,
          startingAvg: '-',
          scores: new Array<number | null>(WEEK_COUNT).fill(null),
        });
      }
    }
  }

  // DUMMY W0 display = mean of real teammates' actual W1 scores
  const realW1Scores = [...shooterMap.values()]
    .filter((s) => !s.isDummy && s.scores[0] !== null)
    .map((s) => s.scores[0] as number);
  if (realW1Scores.length > 0) {
    const dummyW0Display = Math.round(mean(realW1Scores) * 10) / 10;
    for (const s of shooterMap.values()) {
      if (s.isDummy) s.w0Display = dummyW0Display;
    }
  }

  // Compute weeksShot, finalAvg, and final w0Display per shooter
  const rows: ScorecardRowShooter[] = [...shooterMap.values()].map((s) => {
    const nonNull = s.scores.filter((v): v is number => v !== null);
    const weeksShot = nonNull.length > 0 ? nonNull.length : null;
    const w0Num = s.isDummy
      ? (nonNull.length > 0 ? (s.w0Display ?? null) : null)
      : (typeof s.startingAvg === 'number' ? s.startingAvg : null);
    const finalAvg = w0Num !== null
      ? Math.round(computeShooterAverage(w0Num, s.scores, WEEK_COUNT - 1) * 10) / 10
      : nonNull.length > 0
        ? Math.round(mean(nonNull) * 10) / 10
        : (s.w0Display ?? s.startingAvg);
    const w0Display: number | '-' = s.w0Display ?? s.startingAvg;
    return {
      name: s.name,
      rookie: s.rookie,
      isDummy: s.isDummy,
      w0Display,
      scores: s.scores,
      weeksShot,
      finalAvg,
    };
  });

  const withCaptainFirst = sortShootersWithCaptainFirst(rows, teamDoc?.captain ?? '');
  withCaptainFirst.sort((a, b) => {
    if (a.isDummy === b.isDummy) return 0;
    return a.isDummy ? 1 : -1;
  });

  return {
    teamName,
    shooters: withCaptainFirst,
    targets,
    rankPoints,
    bonusPoints,
  };
}
