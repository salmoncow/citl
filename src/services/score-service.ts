/**
 * ScoreService — business logic for shooter scores
 *
 * Wraps ScoreRepository with:
 *   - 1-hour in-memory cache for season / team data
 *   - Input validation
 *   - Result pattern (never throws across module boundaries)
 */

import { success, failure, type Result } from '@/repositories/score-repository';
import { computeSeasonTotals, computeShooterStartingAvg, isShooterRookie, computeDummyScore, isDummyName, normalizeShooterName, getLastWord } from '@/services/scoring-engine';
import type { ScoreRepository } from '@/repositories/score-repository';
import type { Season, SeasonStandings } from '@/types/season';
import type { Team, WeekResult, SeasonEntry, ShooterScore } from '@/types/score';
import type { SeasonData, ScorecardShooter } from '@/types/scorecard';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  ts: number;
}

function getCached<T>(cache: Map<string, CacheEntry<unknown>>, key: string, ttl = CACHE_TTL_MS): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > ttl) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function setCache<T>(cache: Map<string, CacheEntry<unknown>>, key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

// ---------------------------------------------------------------------------
// ScoreService
// ---------------------------------------------------------------------------

export class ScoreService {
  private readonly repository: ScoreRepository;
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(repository: ScoreRepository) {
    if (!repository) throw new Error('ScoreService: repository is required');
    this.repository = repository;
  }

  // -------------------------------------------------------------------------
  // Seasons
  // -------------------------------------------------------------------------

  async getSeason(year: number): Promise<Result<Season | null>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }

    const cacheKey = `season:${year}`;
    const cached = getCached<Season | null>(this.cache, cacheKey);
    if (cached !== undefined) return success(cached);

    const result = await this.repository.getSeason(year);
    if (result.success && result.data) setCache(this.cache, cacheKey, result.data);
    return result;
  }

  async getAllSeasons(): Promise<Result<Season[]>> {
    const cacheKey = 'seasons:all';
    const cached = getCached<Season[]>(this.cache, cacheKey);
    if (cached !== undefined) return success(cached);

    const result = await this.repository.getAllSeasons();
    if (result.success) setCache(this.cache, cacheKey, result.data);
    return result;
  }

  // -------------------------------------------------------------------------
  // Teams
  // -------------------------------------------------------------------------

  async getTeams(year: number): Promise<Result<Team[]>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }

    const cacheKey = `teams:${year}`;
    const cached = getCached<Team[]>(this.cache, cacheKey);
    if (cached !== undefined) return success(cached);

    const result = await this.repository.getTeams(year);
    if (result.success) setCache(this.cache, cacheKey, result.data);
    return result;
  }

  // -------------------------------------------------------------------------
  // Weekly results
  // -------------------------------------------------------------------------

  async getWeekResult(year: number, weekNumber: number): Promise<Result<WeekResult | null>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 15) {
      return failure(`Invalid weekNumber: ${weekNumber} (must be 1–15)`, 'VALIDATION_ERROR');
    }

    const cacheKey = `week:${year}:${weekNumber}`;
    const cached = getCached<WeekResult | null>(this.cache, cacheKey);
    if (cached !== undefined) return success(cached);

    const result = await this.repository.getWeekResult(year, weekNumber);
    if (result.success && result.data) setCache(this.cache, cacheKey, result.data);
    return result;
  }

  async getAllWeekResults(year: number): Promise<Result<WeekResult[]>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }

    const cacheKey = `weeks:${year}`;
    const cached = getCached<WeekResult[]>(this.cache, cacheKey);
    if (cached !== undefined) return success(cached);

    const result = await this.repository.getAllWeekResults(year);
    if (result.success) setCache(this.cache, cacheKey, result.data);
    return result;
  }

  async getLatestWeekResult(year: number): Promise<Result<WeekResult | null>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }

    const cacheKey = `latest:${year}`;
    const cached = getCached<WeekResult | null>(this.cache, cacheKey, 5 * 60 * 1000);
    if (cached !== undefined) return success(cached);

    const result = await this.repository.getLatestWeekResult(year);
    if (result.success && result.data) setCache(this.cache, cacheKey, result.data);
    return result;
  }

  // -------------------------------------------------------------------------
  // Admin writes
  // -------------------------------------------------------------------------

  async saveEntry(year: number, entry: SeasonEntry): Promise<Result<SeasonEntry & { id: string }>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!entry || !entry.weekNumber || !entry.teamId || !entry.teamName) {
      return failure('entry.weekNumber, teamId, and teamName are required', 'VALIDATION_ERROR');
    }
    if (!Array.isArray(entry.shooters) || entry.shooters.length === 0) {
      return failure('entry.shooters must be a non-empty array', 'VALIDATION_ERROR');
    }
    return this.repository.saveEntry(year, entry);
  }

  async getEntry(year: number, weekNumber: number, teamId: string): Promise<Result<SeasonEntry | null>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 15) {
      return failure(`Invalid weekNumber: ${weekNumber}`, 'VALIDATION_ERROR');
    }
    return this.repository.getEntry(year, weekNumber, teamId);
  }

  async getEntries(year: number, maxWeekNumber: number): Promise<Result<SeasonEntry[]>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!Number.isInteger(maxWeekNumber) || maxWeekNumber < 1 || maxWeekNumber > 15) {
      return failure(`Invalid maxWeekNumber: ${maxWeekNumber}`, 'VALIDATION_ERROR');
    }
    return this.repository.getEntries(year, maxWeekNumber);
  }

  async publishWeek(year: number, weekNumber: number): Promise<Result<unknown>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 15) {
      return failure(`Invalid weekNumber: ${weekNumber}`, 'VALIDATION_ERROR');
    }

    const entriesResult = await this.repository.getEntries(year, weekNumber);
    if (!entriesResult.success) return entriesResult;
    const entries = entriesResult.data;

    if (entries.length === 0) {
      return failure(`No entries found for ${year} weeks 1–${weekNumber}`, 'NO_DATA');
    }

    for (const entry of entries) {
      if (entry.weekNumber !== weekNumber) continue;
      const dummyCount = entry.shooters.filter(
        (s) => isDummyName(s.name),
      ).length;
      if (dummyCount > 2) {
        return failure(
          `Team "${entry.teamName}" has ${dummyCount} dummy shooters in week ${weekNumber}; maximum is 2`,
          'VALIDATION_ERROR',
        );
      }
    }

    const teamsResult = await this.repository.getTeams(year);
    if (!teamsResult.success) return teamsResult;
    const teams = teamsResult.data;

    const seasonData = _buildSeasonData(year, teams, entries, weekNumber);

    const computed = computeSeasonTotals(seasonData);

    const wi = weekNumber - 1;
    const teamResults = computed.teams.map((team) => {
      const teamEntry = entries.find(
        (e) => e.weekNumber === weekNumber && e.teamName === team.name,
      );
      // DNS shooters and auto-created dummy positions were given computed dummy scores in
      // _buildSeasonData. Include all of them in shooterScores (score1/score2 null = computed).
      const entryShooterNames = new Set(teamEntry?.shooters.map((s) => s.name) ?? []);
      const extraScores: ShooterScore[] = team.shooters
        .filter((s) => !entryShooterNames.has(s.name) && s.scores[wi] !== null)
        .map((s) => ({ name: s.name, score1: null, score2: null, total: s.scores[wi] as number }));
      return {
        teamId: _slugify(team.name),
        teamName: team.name,
        targets: team.totals.targets[wi] ?? 0,
        rankPoints: team.totals.rankPoints[wi] ?? 0,
        bonusPoints: team.totals.bonusPoints[wi] ?? 0,
        shooterScores: [...(teamEntry?.shooters ?? []), ...extraScores],
      };
    });

    const weekResult: WeekResult = {
      weekNumber,
      publishedAt: new Date().toISOString(),
      teamResults,
    };

    const standings = _computeStandings(computed, weekNumber);

    const publishResult = await this.repository.publishWeek(year, weekResult, {
      currentWeek: weekNumber,
      standings,
      status: 'active',
    });

    if (publishResult.success) {
      this.invalidateWeek(year, weekNumber);
      this.cache.delete(`season:${year}`);
    }

    return publishResult;
  }

  async updateTeamMeta(year: number, teamId: string, name: string, captain: string): Promise<Result<void>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!teamId) return failure('teamId is required', 'VALIDATION_ERROR');
    const trimmedName = name.trim();
    const trimmedCaptain = captain.trim();
    if (!trimmedName) return failure('Team name is required', 'VALIDATION_ERROR');
    if (!trimmedCaptain) return failure('Captain name is required', 'VALIDATION_ERROR');

    const check = await this.repository.getTeam(year, teamId);
    if (!check.success) return check;
    if (check.data === null) return failure(`Team "${teamId}" not found`, 'NOT_FOUND');
    const oldName = check.data.name;

    const result = await this.repository.updateTeamMeta(year, teamId, {
      name: trimmedName,
      captain: trimmedCaptain,
    });
    if (!result.success) return result;
    this.cache.delete(`teams:${year}`);

    if (trimmedName !== oldName) {
      const cascade = await this.repository.cascadeTeamRename(
        year, teamId, oldName, trimmedName,
      );
      if (!cascade.success) return cascade;
    }
    return result;
  }

  async createTeam(year: number, name: string, captain: string): Promise<Result<Team>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    const trimmedName = name.trim();
    const trimmedCaptain = captain.trim();
    if (!trimmedName) return failure('Team name is required', 'VALIDATION_ERROR');
    // captain may be empty at creation time; it is set when the first roster is saved

    const teamId = _slugify(trimmedName);

    // Duplicate check
    const existing = await this.repository.getTeam(year, teamId);
    if (existing.success && existing.data !== null) {
      return failure(`Team "${trimmedName}" already exists for ${year}`, 'DUPLICATE_ERROR');
    }

    const newTeam: Omit<Team, 'id'> = {
      name: trimmedName,
      captain: trimmedCaptain,
      shooters: [],
      totals: { targets: [], rankPoints: [], bonusPoints: [] },
    };

    const result = await this.repository.createTeam(year, teamId, newTeam);
    if (result.success) this.cache.delete(`teams:${year}`);
    return result;
  }

  async computeRosterDefaults(year: number, teamId: string): Promise<Result<Team>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!teamId) return failure('teamId is required', 'VALIDATION_ERROR');

    // Fire all four reads in parallel — one round-trip
    const [currentResult, prior1Result, prior2Result, prior1WeeksResult] = await Promise.all([
      this.repository.getTeam(year, teamId),
      this.repository.getTeams(year - 1),
      this.repository.getTeams(year - 2),
      this.repository.getAllWeekResults(year - 1),
    ]);

    if (!currentResult.success) return currentResult;
    if (currentResult.data === null) {
      return failure(`Team "${teamId}" not found for ${year}`, 'NOT_FOUND');
    }

    // Prior-year failures → empty arrays (graceful degradation, not a hard error)
    const prior1Teams = prior1Result.success ? prior1Result.data : [];
    const prior2Teams = prior2Result.success ? prior2Result.data : [];
    const prior1Weeks = prior1WeeksResult.success ? prior1WeeksResult.data : [];

    // Build name → avg map from prior-year published week results (covers historical seasons)
    const prior1AvgMap = buildPriorAvgMap(prior1Weeks, prior1Teams);

    const updatedShooters = currentResult.data.shooters.map((shooter) => {
      const key = normalizeShooterName(shooter.name);
      return {
        ...shooter,
        startingAvg: prior1AvgMap.get(key)
          ?? computeShooterStartingAvg(shooter.name, prior1Teams),
        rookie: isShooterRookie(shooter.name, prior1Teams, prior2Teams),
      };
    });

    return success({ ...currentResult.data, shooters: updatedShooters });
  }

  async computeShooterDefaults(
    year: number,
    shooterName: string,
  ): Promise<Result<{ startingAvg: number; rookie: boolean }>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100)
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    if (!shooterName.trim())
      return failure('shooterName is required', 'VALIDATION_ERROR');

    const [prior1Result, prior2Result, prior1WeeksResult] = await Promise.all([
      this.repository.getTeams(year - 1),
      this.repository.getTeams(year - 2),
      this.repository.getAllWeekResults(year - 1),
    ]);

    const prior1Teams = prior1Result.success ? prior1Result.data : [];
    const prior2Teams = prior2Result.success ? prior2Result.data : [];
    const prior1Weeks = prior1WeeksResult.success ? prior1WeeksResult.data : [];
    const prior1AvgMap = buildPriorAvgMap(prior1Weeks, prior1Teams);

    const key = normalizeShooterName(shooterName);
    return success({
      startingAvg: prior1AvgMap.get(key) ?? computeShooterStartingAvg(shooterName, prior1Teams),
      rookie: isShooterRookie(shooterName, prior1Teams, prior2Teams),
    });
  }

  async deleteTeam(year: number, teamId: string): Promise<Result<void>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!teamId) return failure('teamId is required', 'VALIDATION_ERROR');

    const result = await this.repository.deleteTeam(year, teamId);
    if (result.success) {
      this.cache.delete(`teams:${year}`);
      this.cache.delete(`weeks:${year}`);
      this.cache.delete(`latest:${year}`);
      this.cache.delete(`season:${year}`);
      for (let w = 1; w <= 15; w++) this.cache.delete(`week:${year}:${w}`);

      // Recompute standings from the updated week docs (deleted team already removed by repo)
      const weeksResult = await this.repository.getAllWeekResults(year);
      if (weeksResult.success && weeksResult.data.length > 0) {
        const newStandings = _recomputeStandingsFromWeeks(weeksResult.data);
        await this.repository.updateSeason(year, { standings: newStandings } as Partial<Season>);
        this.cache.delete(`season:${year}`);
      }
    }
    return result;
  }

  async removeShooterFromRoster(
    year: number,
    teamId: string,
    shooterName: string,
  ): Promise<Result<void>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!teamId) return failure('teamId is required', 'VALIDATION_ERROR');
    const trimmedName = shooterName.trim();
    if (!trimmedName) return failure('shooterName is required', 'VALIDATION_ERROR');

    // Verify team exists and shooter is on it
    const teamResult = await this.repository.getTeam(year, teamId);
    if (!teamResult.success) return teamResult;
    if (teamResult.data === null) {
      return failure(`Team "${teamId}" not found for ${year}`, 'NOT_FOUND');
    }
    const normalizedTarget = normalizeShooterName(trimmedName);
    const team = teamResult.data;
    const shooterOnRoster = team.shooters.some(
      (s) => normalizeShooterName(s.name) === normalizedTarget,
    );
    if (!shooterOnRoster) {
      return failure(`Shooter "${trimmedName}" not found on team roster`, 'NOT_FOUND');
    }

    // Fetch all 15 entry docs in parallel (getDoc on non-existent is a fast null)
    const entryResults = await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        this.repository.getEntry(year, i + 1, teamId),
      ),
    );

    // Filter shooter from team roster
    const updatedShooters = team.shooters.filter(
      (s) => normalizeShooterName(s.name) !== normalizedTarget,
    );

    // Filter shooter from each entry that contains them
    const entryUpdates: SeasonEntry[] = [];
    for (const result of entryResults) {
      if (!result.success || result.data === null) continue;
      const entry = result.data;
      const hadShooter = entry.shooters.some(
        (s) => normalizeShooterName(s.name) === normalizedTarget,
      );
      if (!hadShooter) continue;
      entryUpdates.push({
        ...entry,
        shooters: entry.shooters.filter(
          (s) => normalizeShooterName(s.name) !== normalizedTarget,
        ),
      });
    }

    const writeResult = await this.repository.removeShooterFromRosterAndEntries(
      year,
      teamId,
      updatedShooters,
      entryUpdates,
    );
    if (writeResult.success) this.cache.delete(`teams:${year}`);
    return writeResult;
  }

  async saveTeamRoster(
    year: number,
    teamId: string,
    captain: string,
    shooters: Team['shooters'],
  ): Promise<Result<void>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!teamId) return failure('teamId is required', 'VALIDATION_ERROR');
    const trimmedCaptain = captain.trim();
    if (shooters.length < 5) {
      return failure('A team must have at least 5 shooters', 'VALIDATION_ERROR');
    }
    for (const s of shooters) {
      if (!s.name.trim()) return failure('All shooter names are required', 'VALIDATION_ERROR');
    }

    // Verify team exists before updating
    const check = await this.repository.getTeam(year, teamId);
    if (!check.success) return check;
    if (check.data === null) return failure(`Team "${teamId}" not found for ${year}`, 'NOT_FOUND');

    const result = await this.repository.saveTeamRoster(year, teamId, {
      captain: trimmedCaptain,
      shooters,
    });
    if (result.success) this.cache.delete(`teams:${year}`);
    return result;
  }

  // -------------------------------------------------------------------------
  // Cache control
  // -------------------------------------------------------------------------

  invalidateWeek(year: number, weekNumber: number): void {
    this.cache.delete(`week:${year}:${weekNumber}`);
    this.cache.delete(`weeks:${year}`);
    this.cache.delete(`latest:${year}`);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// ---------------------------------------------------------------------------
// Private helpers for publishWeek
// ---------------------------------------------------------------------------

function _slugify(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}


function _buildSeasonData(
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

    const seenNames = new Set<string>();
    for (const [wn, entry] of teamEntries) {
      if (wn > maxWeek) continue;
      for (const s of entry.shooters) seenNames.add(s.name);
    }

    const rosterShooters: ScorecardShooter[] = (firestoreTeam.shooters ?? []).map((rs) => {
      seenNames.delete(rs.name);
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

    const subShooters: ScorecardShooter[] = [...seenNames].map((name) => ({
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
        const shooter = shooters.find((s) => s.name === entryShooter.name);
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
 * Build a name→finalAvg map from published WeekResult documents, applying the
 * same business rule as computeShooterAverage: when a shooter has fewer than
 * 2 weeks of actual scores, the starting average is blended into the mean.
 * priorTeams is required for that startingAvg lookup.
 *
 * Exported so the scorecard component can reuse this logic without duplicating it.
 */
export function buildPriorAvgMap(weekResults: WeekResult[], priorTeams: Team[]): Map<string, number> {
  // Build startingAvg lookup keyed by lowercased name (first match wins)
  const startingAvgMap = new Map<string, number>();
  for (const team of priorTeams) {
    for (const shooter of team.shooters) {
      const key = normalizeShooterName(shooter.name);
      if (!startingAvgMap.has(key)) {
        startingAvgMap.set(key, shooter.startingAvg ?? 35);
      }
    }
  }

  const acc = new Map<string, { total: number; weeks: number }>();
  for (const wr of weekResults) {
    for (const tr of wr.teamResults ?? []) {
      for (const s of tr.shooterScores ?? []) {
        if (typeof s.total !== 'number' || !isFinite(s.total)) continue;
        const key = normalizeShooterName(s.name);
        const cur = acc.get(key) ?? { total: 0, weeks: 0 };
        acc.set(key, { total: cur.total + s.total, weeks: cur.weeks + 1 });
      }
    }
  }

  const result = new Map<string, number>();
  for (const [key, { total, weeks }] of acc) {
    let avg: number;
    if (weeks < 2) {
      // Mirror computeShooterAverage: blend startingAvg into mean until ≥ 2 weeks shot
      const startingAvg = startingAvgMap.get(key) ?? 35;
      avg = (startingAvg + total) / (weeks + 1);
    } else {
      avg = total / weeks;
    }
    result.set(key, parseFloat(avg.toFixed(1)));
  }
  return result;
}


/**
 * Recompute season standings by summing the stored per-week TeamResult values.
 * Used after team deletion — the deleted team is already absent from weekResults.
 */
function _recomputeStandingsFromWeeks(weekResults: WeekResult[]): SeasonStandings[] {
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
  const rows = [...acc.values()].sort(
    (a, b) => (b.rankPoints + b.bonusPoints) - (a.rankPoints + a.bonusPoints),
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

function _computeStandings(computed: SeasonData, throughWeek: number): SeasonStandings[] {
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
      teamId: _slugify(team.name),
      teamName: team.name,
      totalRankPoints,
      totalBonusPoints,
      totalTargets,
    };
  });

  rows.sort((a, b) => (b.totalRankPoints + b.totalBonusPoints) - (a.totalRankPoints + a.totalBonusPoints));

  return rows.map((row, i) => ({ rank: i + 1, ...row }));
}
