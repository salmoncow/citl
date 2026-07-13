/**
 * seed-data.js — Deterministic fixture builders for the emulator seed.
 *
 * No randomness, no timestamps from the clock — every run produces identical
 * documents so tests, screenshots, and bug repros remain reproducible.
 *
 * Schema references (keep in sync if these change):
 *   src/types/season.ts        Season, SeasonStandings, SeasonAwards
 *   src/types/score.ts         Team, TeamTotals, WeekResult, TeamResult,
 *                              ShooterScore, SeasonEntry
 *   src/types/shooter.ts       Shooter, Accolade
 *   src/types/announcement.ts  Announcement
 *   src/types/user.ts          UserDoc, Role
 */

export const ACTIVE_YEAR = 2024;
export const COMPLETE_YEAR = 2025;
export const WEEKS_PER_SEASON = 15;
export const ACTIVE_WEEKS_PUBLISHED = 5; // week 6 carries draft entries

const TEAMS = [
  { id: 'eagles', name: 'Eagles', captain: 'Greg Litchfield' },
  { id: 'falcons', name: 'Falcons', captain: 'Mike Hardy' },
  { id: 'hawks', name: 'Hawks', captain: 'Dave Brennan' },
  { id: 'kestrels', name: 'Kestrels', captain: 'Tom Schroeder' },
];

const SHOOTERS_BY_TEAM = {
  eagles: ['Greg Litchfield', 'Aaron Klein', 'Pete Sandoval', 'Rick Mancuso'],
  falcons: ['Mike Hardy', 'Carl Webb', 'Steve Aldrich', 'Doug Reilly'],
  hawks: ['Dave Brennan', 'Frank Holt', 'Larry Pence', 'Joe Vance'],
  kestrels: ['Tom Schroeder', 'Bill Frey', 'Hank Olson', 'Norm Brady'],
};

// ── Deterministic round-score generator ────────────────────────────────────

function roundScore(seed, base) {
  const h = (seed * 9301 + 49297) % 233280;
  const v = base + ((h % 9) - 4);
  return Math.max(0, Math.min(25, v));
}

function makeRounds(teamIdx, shooterIdx, weekIdx) {
  const base = 18 + ((teamIdx + shooterIdx) % 5); // 18–22 base avg per round
  const seed = teamIdx * 100 + shooterIdx * 17 + weekIdx * 3 + 1;
  const score1 = roundScore(seed, base);
  const score2 = roundScore(seed + 11, base);
  return { score1, score2, total: score1 + score2 };
}

// ── Shooter / Team builders ────────────────────────────────────────────────

function buildShooter(teamIdx, shooterIdx, name, weeksPlayed) {
  const scores = Array.from({ length: WEEKS_PER_SEASON }, (_, w) => {
    if (w >= weeksPlayed) return null;
    return makeRounds(teamIdx, shooterIdx, w).total;
  });
  const played = scores.filter((s) => s !== null);
  const startingAvg = 38 + ((teamIdx + shooterIdx) % 8);
  const finalAvg = played.length
    ? Math.round((played.reduce((a, b) => a + b, 0) / played.length) * 100) / 100
    : null;
  return {
    id: `${name.toLowerCase().replace(/\s+/g, '-')}-t${teamIdx}-s${shooterIdx}`,
    name,
    rookie: shooterIdx === 3, // every team's 4th shooter is a rookie
    startingAvg,
    finalAvg,
    weeksShot: played.length || null,
    scores,
  };
}

export function buildTeam(teamIdx, weeksPlayed) {
  const team = TEAMS[teamIdx];
  const shooters = SHOOTERS_BY_TEAM[team.id].map((name, shooterIdx) =>
    buildShooter(teamIdx, shooterIdx, name, weeksPlayed),
  );
  const targets = Array.from({ length: WEEKS_PER_SEASON }, (_, w) => {
    if (w >= weeksPlayed) return null;
    return shooters.reduce((sum, s) => sum + (s.scores[w] ?? 0), 0);
  });
  return {
    id: team.id,
    name: team.name,
    captain: team.captain,
    shooters,
    totals: {
      targets,
      rankPoints: Array.from({ length: WEEKS_PER_SEASON }, () => null),
      bonusPoints: Array.from({ length: WEEKS_PER_SEASON }, () => null),
    },
  };
}

// ── Weekly results ──────────────────────────────────────────────────────────

function rankWeek(weekIdx, teams) {
  const rows = teams.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    targets: t.totals.targets[weekIdx] ?? 0,
  }));
  rows.sort((a, b) => b.targets - a.targets);
  return rows.map((r, i) => ({
    ...r,
    rankPoints: teams.length - i,
    bonusPoints: 1,
  }));
}

export function buildWeekResult(weekIdx, teams) {
  const ranked = rankWeek(weekIdx, teams);
  const teamResults = teams.map((team) => {
    const r = ranked.find((x) => x.teamId === team.id);
    const teamIdx = TEAMS.findIndex((t) => t.id === team.id);
    const shooterScores = team.shooters.map((s, shooterIdx) => {
      const rounds = makeRounds(teamIdx, shooterIdx, weekIdx);
      return { name: s.name, ...rounds };
    });
    return {
      teamId: team.id,
      teamName: team.name,
      targets: r.targets,
      rankPoints: r.rankPoints,
      bonusPoints: r.bonusPoints,
      shooterScores,
    };
  });
  // Backfill rank/bonus on the parent team totals so SeasonStandings can sum them.
  for (const team of teams) {
    const r = ranked.find((x) => x.teamId === team.id);
    team.totals.rankPoints[weekIdx] = r.rankPoints;
    team.totals.bonusPoints[weekIdx] = r.bonusPoints;
  }
  const accolades = [];
  for (const tr of teamResults) {
    for (const ss of tr.shooterScores) {
      if (ss.score1 === 25 || ss.score2 === 25) {
        accolades.push({ shooterName: ss.name, teamName: tr.teamName, streak: 25 });
      }
    }
  }
  // Deterministic publish stamp: Tuesday evenings starting early March.
  const publishedAt = new Date(Date.UTC(2024, 2, 5 + weekIdx * 7, 2, 30)).toISOString();
  return {
    weekNumber: weekIdx + 1,
    publishedAt,
    teamResults,
    accolades,
  };
}

export function buildEntry(year, weekIdx, team) {
  const teamIdx = TEAMS.findIndex((t) => t.id === team.id);
  const shooters = team.shooters.map((s, shooterIdx) => {
    const rounds = makeRounds(teamIdx, shooterIdx, weekIdx);
    return { name: s.name, ...rounds };
  });
  // Saved-at: noon UTC on the Tuesday of that week.
  const savedAt = new Date(Date.UTC(year, 2, 5 + weekIdx * 7, 17, 0)).toISOString();
  return {
    year,
    weekNumber: weekIdx + 1,
    teamId: team.id,
    teamName: team.name,
    savedAt,
    shooters,
  };
}

// ── Season aggregates ──────────────────────────────────────────────────────

function buildStandings(teams, throughWeekIdx) {
  const rows = teams.map((team) => {
    let totalRankPoints = 0;
    let totalBonusPoints = 0;
    let totalTargets = 0;
    for (let w = 0; w <= throughWeekIdx; w++) {
      totalRankPoints += team.totals.rankPoints[w] ?? 0;
      totalBonusPoints += team.totals.bonusPoints[w] ?? 0;
      totalTargets += team.totals.targets[w] ?? 0;
    }
    return {
      rank: 0,
      teamId: team.id,
      teamName: team.name,
      totalRankPoints,
      totalBonusPoints,
      totalTargets,
    };
  });
  rows.sort((a, b) => {
    if (b.totalRankPoints !== a.totalRankPoints) return b.totalRankPoints - a.totalRankPoints;
    if (b.totalBonusPoints !== a.totalBonusPoints) return b.totalBonusPoints - a.totalBonusPoints;
    return b.totalTargets - a.totalTargets;
  });
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}

/**
 * Flat SeasonAwards shape (src/types/season.ts) — the shape all seven prod
 * seasons store. Plain-JS mirror of the engine's rules; must not import the
 * TS engine. Complete seasons only: placements come from the full-season
 * standings (rank 1/2, points = rank + bonus totals).
 */
export function buildAwards(teams) {
  const standings = buildStandings(teams, WEEKS_PER_SEASON - 1);
  const first = standings.find((r) => r.rank === 1) ?? null;
  const second = standings.find((r) => r.rank === 2) ?? null;

  let top = null; //     { name, avg }
  let rookie = null; //  { name, avg }
  let improved = null; // { name, score }
  for (const team of teams) {
    for (const s of team.shooters) {
      if (s.finalAvg === null) continue;
      if (!top || s.finalAvg > top.avg) top = { name: s.name, avg: s.finalAvg };
      if (s.rookie && (!rookie || s.finalAvg > rookie.avg)) rookie = { name: s.name, avg: s.finalAvg };
      // Most Improved formula with the startingAvg >= 50 guard (engine DD-4).
      const score = s.startingAvg >= 50 ? 0 : (100 * (s.finalAvg - s.startingAvg)) / (50 - s.startingAvg);
      if (!improved || score > improved.score) improved = { name: s.name, score };
    }
  }

  return {
    firstPlaceTeam: first ? first.teamName : null,
    firstPlacePoints: first ? first.totalRankPoints + first.totalBonusPoints : null,
    secondPlaceTeam: second ? second.teamName : null,
    secondPlacePoints: second ? second.totalRankPoints + second.totalBonusPoints : null,
    highestAvgShooter: top ? top.name : null,
    highestAvg: top ? top.avg : null,
    rookieOfYear: rookie ? rookie.name : null,
    rookieAvg: rookie ? rookie.avg : null,
    mostImproved: improved ? improved.name : null,
    improvement: improved ? `${improved.score.toFixed(2)}%` : null,
  };
}

export function buildSeason(year, status, currentWeek, teams, awards) {
  const throughWeekIdx =
    status === 'complete' ? WEEKS_PER_SEASON - 1 : currentWeek - 2;
  const standings =
    throughWeekIdx >= 0
      ? buildStandings(teams, throughWeekIdx)
      : teams.map((t, i) => ({
          rank: i + 1,
          teamId: t.id,
          teamName: t.name,
          totalRankPoints: 0,
          totalBonusPoints: 0,
          totalTargets: 0,
        }));
  return {
    id: String(year),
    year,
    status,
    currentWeek,
    standings,
    // Active seasons carry NO awards field, matching prod (2026 has the
    // field absent until the Season End finalize flow writes it).
    ...(awards ? { awards } : {}),
  };
}

// ── Users, announcements, config ────────────────────────────────────────────

export const TEST_USERS = [
  { uid: 'seed-owner', email: 'owner@citl.test', displayName: 'Seed Owner', role: 'owner' },
  { uid: 'seed-admin', email: 'admin@citl.test', displayName: 'Seed Admin', role: 'admin' },
  { uid: 'seed-user', email: 'user@citl.test', displayName: 'Seed User', role: 'user' },
];

export const ANNOUNCEMENTS = [
  {
    year: ACTIVE_YEAR,
    title: 'Season opener postponed one week',
    body: 'Forecast freezing rain — Week 1 moves from March 5 to March 12. Same lineup; see you Tuesday at 6pm.',
    postedAtMs: Date.UTC(2024, 1, 28, 14, 0),
  },
  {
    year: ACTIVE_YEAR,
    title: 'Banquet date confirmed',
    body: 'End-of-season banquet is **September 14** at Roma\'s. RSVPs by Sept 7.',
    postedAtMs: Date.UTC(2024, 6, 15, 18, 0),
  },
  {
    year: COMPLETE_YEAR,
    title: 'Congratulations to the 2025 champions',
    body: 'A great season — full standings and awards are now posted under Past Seasons.',
    postedAtMs: Date.UTC(2025, 7, 20, 12, 0),
  },
];

export const BANNER_MESSAGE = 'Local dev seed loaded — see CONTRIBUTING.md#seeding-the-emulator';
