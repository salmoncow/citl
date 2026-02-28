#!/usr/bin/env node
/**
 * import-historical.js
 *
 * One-time script: reads src/data/scorecards/{year}.json for each historical year
 * and writes WeekResult documents + a Season document to Firestore.
 *
 * Uses the Firebase Admin SDK (bypasses security rules — safe for server scripts).
 * No `entries` documents are written; historical data skips the audit trail.
 *
 * Prerequisites:
 *   1. Firestore must be enabled in the Firebase console.
 *   2. Download a service account key from Firebase console:
 *      Project Settings → Service Accounts → Generate new private key
 *      Save as service-account.json in the project root (git-ignored).
 *   3. npm install (installs firebase-admin)
 *
 * Usage:
 *   node scripts/import-historical.js [--year 2025] [--dry-run] [--key-file /path/to/key.json]
 *
 * Options:
 *   --year <year>      Only import one year (default: all years in src/data/scorecards/)
 *   --dry-run          Print what would be written without writing to Firestore
 *   --key-file <path>  Path to service account key (default: ./service-account.json)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { computeSeasonAwards } from '../src/services/scoring-engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const yearArg = args.includes('--year') ? parseInt(args[args.indexOf('--year') + 1], 10) : null;
const dryRun = args.includes('--dry-run');
const keyFileIdx = args.indexOf('--key-file');
const keyFilePath = keyFileIdx >= 0 ? args[keyFileIdx + 1] : join(ROOT, 'service-account.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a Firestore document ID from a team name.
 * Must match _slugify() in src/services/score-service.js.
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Sum an array treating null/undefined as 0.
 * @param {(number|null|undefined)[]} arr
 * @returns {number}
 */
function sumArr(arr) {
  return (arr ?? []).reduce((acc, v) => acc + (v ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Load service account key
// ---------------------------------------------------------------------------

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyFilePath, 'utf8'));
} catch {
  console.error(`ERROR: could not read service account key at: ${keyFilePath}`);
  console.error('  Download from Firebase console: Project Settings → Service Accounts → Generate new private key');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Discover scorecard files
// ---------------------------------------------------------------------------

const scorecardsDir = join(ROOT, 'src', 'data', 'scorecards');
let years;

if (yearArg) {
  years = [yearArg];
} else {
  const files = readdirSync(scorecardsDir).filter((f) => extname(f) === '.json');
  years = files
    .map((f) => parseInt(basename(f, '.json'), 10))
    .filter((y) => !isNaN(y))
    .sort();
}

if (years.length === 0) {
  console.error('ERROR: no scorecard files found in', scorecardsDir);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Initialize Firestore (skipped in dry-run)
// ---------------------------------------------------------------------------

if (!dryRun) {
  initializeApp({ credential: cert(serviceAccount) });
  var db = getFirestore();
}

// ---------------------------------------------------------------------------
// Import each year
// ---------------------------------------------------------------------------

const WEEK_COUNT = 15;
let totalWeeksWritten = 0;
let totalSeasonsWritten = 0;

for (const year of years) {
  const scorecardPath = join(scorecardsDir, `${year}.json`);
  let scorecardJson;
  try {
    scorecardJson = JSON.parse(readFileSync(scorecardPath, 'utf8'));
  } catch (err) {
    console.error(`ERROR: could not read ${scorecardPath}: ${err.message}`);
    continue;
  }

  console.log(`\nYear ${year}: ${scorecardJson.teams.length} teams`);

  // Add isDummy to each shooter so computeSeasonAwards can exclude them.
  // The scorecard JSON does not store isDummy; it is derived from the name.
  const seasonData = {
    season: year,
    teams: scorecardJson.teams.map((team) => ({
      ...team,
      shooters: team.shooters.map((s) => ({
        ...s,
        isDummy: s.name.toUpperCase().includes('DUMMY'),
      })),
    })),
  };

  // -------------------------------------------------------------------------
  // Compute season awards (highest avg, rookie of year, most improved)
  // -------------------------------------------------------------------------

  const awards = computeSeasonAwards(seasonData);

  // -------------------------------------------------------------------------
  // Build and write a WeekResult for each week that was actually played
  // -------------------------------------------------------------------------

  let lastPlayedWeek = 0;

  for (let wi = 0; wi < WEEK_COUNT; wi++) {
    const weekNumber = wi + 1;

    // A week was played if at least one team has a non-null targets value.
    // Forfeiting teams have null targets; weeks never played have null for everyone.
    const weekWasPlayed = seasonData.teams.some(
      (team) => (team.totals?.targets?.[wi] ?? null) !== null,
    );

    if (!weekWasPlayed) continue;

    lastPlayedWeek = weekNumber;

    // Build teamResults — include all teams (forfeiting teams get 0 targets).
    const teamResults = seasonData.teams.map((team) => {
      // Only include shooters who actually shot this week.
      const shooterScores = team.shooters
        .filter((s) => (s.scores?.[wi] ?? null) !== null)
        .map((s) => ({
          name: s.name,
          score1: null,   // historical: round split not available
          score2: null,
          total: s.scores[wi],
        }));

      return {
        teamId: slugify(team.name),
        teamName: team.name,
        targets: team.totals?.targets?.[wi] ?? 0,
        rankPoints: team.totals?.rankPoints?.[wi] ?? 0,
        bonusPoints: team.totals?.bonusPoints?.[wi] ?? 0,
        shooterScores,
      };
    });

    /** @type {import('../src/types/score.js').WeekResult} */
    const weekResult = {
      weekNumber,
      publishedAt: null,
      teamResults,
    };

    if (dryRun) {
      const summary = teamResults
        .map((t) => `${t.teamName}: ${t.targets}T ${t.rankPoints}RP ${t.bonusPoints}BP`)
        .join(' | ');
      console.log(`  [dry-run] seasons/${year}/weeks/${weekNumber}: ${summary}`);
    } else {
      try {
        await db
          .collection('seasons')
          .doc(String(year))
          .collection('weeks')
          .doc(String(weekNumber))
          .set(weekResult);
        console.log(`  ✓ seasons/${year}/weeks/${weekNumber}`);
        totalWeeksWritten++;
      } catch (err) {
        console.error(`  ✗ seasons/${year}/weeks/${weekNumber}: ${err.message}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Compute cumulative season standings (all played weeks)
  // -------------------------------------------------------------------------

  const standingsRows = seasonData.teams.map((team) => ({
    teamId: slugify(team.name),
    teamName: team.name,
    totalRankPoints: sumArr(team.totals?.rankPoints),
    totalBonusPoints: sumArr(team.totals?.bonusPoints),
    totalTargets: sumArr(team.totals?.targets),
  }));

  standingsRows.sort(
    (a, b) =>
      (b.totalRankPoints + b.totalBonusPoints) - (a.totalRankPoints + a.totalBonusPoints),
  );

  const standings = standingsRows.map((row, i) => ({ rank: i + 1, ...row }));

  // Fill in first/second place team from standings (computeSeasonAwards leaves these null).
  const fullAwards = {
    ...awards,
    firstPlaceTeam: standings[0]?.teamName ?? null,
    firstPlacePoints: standings[0]
      ? standings[0].totalRankPoints + standings[0].totalBonusPoints
      : null,
    secondPlaceTeam: standings[1]?.teamName ?? null,
    secondPlacePoints: standings[1]
      ? standings[1].totalRankPoints + standings[1].totalBonusPoints
      : null,
  };

  // -------------------------------------------------------------------------
  // Write Season document
  // -------------------------------------------------------------------------

  const seasonDoc = {
    year,
    status: 'complete',
    currentWeek: lastPlayedWeek,
    standings,
    awards: fullAwards,
  };

  if (dryRun) {
    console.log(`  [dry-run] seasons/${year}:`, JSON.stringify({
      year: seasonDoc.year,
      status: seasonDoc.status,
      currentWeek: seasonDoc.currentWeek,
      standingsCount: seasonDoc.standings.length,
      firstPlace: seasonDoc.standings[0]?.teamName,
      awards: seasonDoc.awards,
    }, null, 2));
  } else {
    try {
      await db.collection('seasons').doc(String(year)).set(seasonDoc);
      console.log(
        `  ✓ seasons/${year} (currentWeek=${lastPlayedWeek}, ${standings.length} teams, 1st: ${standings[0]?.teamName})`,
      );
      totalSeasonsWritten++;
    } catch (err) {
      console.error(`  ✗ seasons/${year}: ${err.message}`);
    }
  }
}

if (dryRun) {
  console.log('\n[dry-run] No writes performed.');
} else {
  console.log(`\nDone. ${totalWeeksWritten} week docs + ${totalSeasonsWritten} season docs written.`);
  process.exit(0);
}
