/**
 * ScoreService — business logic for shooter scores
 *
 * Wraps ScoreRepository with:
 *   - 1-hour in-memory cache for season / team data
 *   - Input validation
 *   - Result pattern (never throws across module boundaries)
 */

import { success, failure, type Result } from '@/repositories/score-repository';
import { buildPriorAvgMap, computeSeasonTotals, computeShooterStartingAvg, isShooterRookie, isDummyName, normalizeShooterName, computeAccolades } from '@/services/scoring-engine';
import { buildSeasonData, buildScorecardTeamBlock } from '@/services/scorecard-builder';
import { computeStandings, recomputeStandingsFromWeeks } from '@/services/standings';
import type { ScoreRepository } from '@/repositories/score-repository';
import type { Season, SeasonStandings } from '@/types/season';
import type { Team, WeekResult, SeasonEntry, ShooterScore } from '@/types/score';
import type { SeasonData, ScorecardShooter, ScorecardRowShooter, ScorecardTeamBlock, ScorecardViewData } from '@/types/scorecard';
import type { Announcement } from '@/types/announcement';

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
    // Cache nulls too — a nonexistent season is as cacheable as a real one,
    // and skipping it made every repeat lookup a fresh Firestore read (F-48).
    if (result.success) setCache(this.cache, cacheKey, result.data);
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
    if (result.success) setCache(this.cache, cacheKey, result.data);
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
    if (result.success) setCache(this.cache, cacheKey, result.data);
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
    // The class contract promises no throws across module boundaries — an
    // exception here would wedge the admin UI's Publishing… state (F-09).
    try {
      return await this._publishWeekInner(year, weekNumber);
    } catch (err) {
      return failure(`Publish failed unexpectedly: ${(err as Error).message}`, 'INTERNAL_ERROR');
    }
  }

  private async _publishWeekInner(year: number, weekNumber: number): Promise<Result<unknown>> {
    // Determine the true max published week so republishing an earlier week
    // (a supported correction flow) never rewinds standings/currentWeek (F-05).
    const existingSeasonResult = await this.repository.getSeason(year);
    if (!existingSeasonResult.success) return existingSeasonResult;
    const maxWeek = Math.max(existingSeasonResult.data?.currentWeek ?? 0, weekNumber);

    // Build through maxWeek so standings reflect every already-published week,
    // not just the one being (re)published. getEntries returns weeks <= maxWeek.
    const entriesResult = await this.repository.getEntries(year, maxWeek);
    if (!entriesResult.success) return entriesResult;
    const entries = entriesResult.data;

    if (!entries.some((e) => e.weekNumber === weekNumber)) {
      return failure(`No entries found for ${year} week ${weekNumber}`, 'NO_DATA');
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

    // Resolve teamId from the stable team document id, not a re-slugified
    // display name — otherwise a mid-season rename corrupts every later
    // week/standings row keyed by teamId (F-08).
    const teamIdByName = new Map(teams.map((t) => [t.name, t.id]));
    const resolveTeamId = (name: string): string => teamIdByName.get(name) ?? _slugify(name);

    const seasonData = buildSeasonData(year, teams, entries, maxWeek);

    const computed = computeSeasonTotals(seasonData);

    const wi = weekNumber - 1;
    const teamResults = computed.teams.map((team) => {
      const teamEntry = entries.find(
        (e) => e.weekNumber === weekNumber && e.teamName === team.name,
      );
      // DNS shooters and auto-created dummy positions were given computed dummy scores in
      // buildSeasonData. Include all of them in shooterScores (score1/score2 null = computed).
      // Compare normalized so a case/whitespace variant in the saved entry
      // doesn't duplicate the roster shooter here (F-51).
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

    const weekResult: WeekResult = {
      weekNumber,
      publishedAt: new Date().toISOString(),
      teamResults,
      accolades: computeAccolades(teamResults),
    };

    const standings = computeStandings(computed, maxWeek, resolveTeamId);

    const publishResult = await this.repository.publishWeek(year, weekResult, {
      currentWeek: maxWeek,
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
      shooters: trimmedCaptain ? [{
        id: '',
        name: trimmedCaptain,
        rookie: true,
        startingAvg: 35,
        finalAvg: null,
        weeksShot: null,
        scores: [],
      }] : [],
      totals: { targets: [], rankPoints: [], bonusPoints: [] },
    };

    const result = await this.repository.createTeam(year, teamId, newTeam);
    if (result.success) {
      this.cache.delete(`teams:${year}`);
      // createTeam also seeds the season doc; drop any cached null/stale
      // season so the new year appears without waiting out the TTL (F-48).
      this.cache.delete(`season:${year}`);
      this.cache.delete('seasons:all');
    }
    return result;
  }

  async computeRosterDefaults(year: number, teamId: string): Promise<Result<Team>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!teamId) return failure('teamId is required', 'VALIDATION_ERROR');

    // Fire all five reads in parallel — one round-trip. Prior-year reads go
    // through the cached getters so repeated modal opens don't re-query
    // immutable history (F-48); year-of-range failures degrade to [] below.
    const [currentResult, prior1Result, prior2Result, prior1WeeksResult, prior2WeeksResult] = await Promise.all([
      this.repository.getTeam(year, teamId),
      this.getTeams(year - 1),
      this.getTeams(year - 2),
      this.getAllWeekResults(year - 1),
      this.getAllWeekResults(year - 2),
    ]);

    if (!currentResult.success) return currentResult;
    if (currentResult.data === null) {
      return failure(`Team "${teamId}" not found for ${year}`, 'NOT_FOUND');
    }

    // Prior-year failures → empty arrays (graceful degradation, not a hard error)
    const prior1Teams = prior1Result.success ? prior1Result.data : [];
    const prior2Teams = prior2Result.success ? prior2Result.data : [];
    const prior1Weeks = prior1WeeksResult.success ? prior1WeeksResult.data : [];
    const prior2Weeks = prior2WeeksResult.success ? prior2WeeksResult.data : [];

    // Build name → avg maps from published week results for both prior years.
    // prior2AvgMap provides a fallback for shooters who skipped year N-1 but
    // shot in year N-2, and drives accurate rookie detection for both years.
    const prior1AvgMap = buildPriorAvgMap(prior1Weeks, prior1Teams);
    const prior2AvgMap = buildPriorAvgMap(prior2Weeks, prior2Teams);

    const updatedShooters = currentResult.data.shooters.map((shooter) => {
      const key = normalizeShooterName(shooter.name);
      return {
        ...shooter,
        startingAvg: prior1AvgMap.get(key)
          ?? prior2AvgMap.get(key)
          ?? computeShooterStartingAvg(shooter.name, [...prior1Teams, ...prior2Teams]),
        rookie: isShooterRookie(shooter.name, prior1Teams, prior2Teams, prior1AvgMap, prior2AvgMap),
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

    const [prior1Result, prior2Result, prior1WeeksResult, prior2WeeksResult] = await Promise.all([
      this.getTeams(year - 1),
      this.getTeams(year - 2),
      this.getAllWeekResults(year - 1),
      this.getAllWeekResults(year - 2),
    ]);

    const prior1Teams = prior1Result.success ? prior1Result.data : [];
    const prior2Teams = prior2Result.success ? prior2Result.data : [];
    const prior1Weeks = prior1WeeksResult.success ? prior1WeeksResult.data : [];
    const prior2Weeks = prior2WeeksResult.success ? prior2WeeksResult.data : [];
    const prior1AvgMap = buildPriorAvgMap(prior1Weeks, prior1Teams);
    const prior2AvgMap = buildPriorAvgMap(prior2Weeks, prior2Teams);

    const key = normalizeShooterName(shooterName);
    return success({
      startingAvg: prior1AvgMap.get(key)
        ?? prior2AvgMap.get(key)
        ?? computeShooterStartingAvg(shooterName, [...prior1Teams, ...prior2Teams]),
      rookie: isShooterRookie(shooterName, prior1Teams, prior2Teams, prior1AvgMap, prior2AvgMap),
    });
  }

  /**
   * Build the full per-team display data for the season-scorecards view.
   * Returns one ScorecardTeamBlock per team (rostered teams first, in roster
   * order; then any teams that appear in published week results but not on
   * the current roster). Each shooter row carries fully computed display
   * fields: prior-blended starting/W0 value, rookie flag, scores, weeksShot,
   * and final average. Shooters are pre-sorted (captain first among real
   * shooters; dummies last).
   *
   * Failures fetching current-year data return an empty `teams` array with
   * `success: true` so the caller can render a "no data" placeholder.
   */
  async buildScorecardData(year: number): Promise<Result<ScorecardViewData>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }

    const [teamsResult, weeksResult, prior1TeamsResult, prior2TeamsResult, prior1WeeksResult, prior2WeeksResult] = await Promise.all([
      this.getTeams(year),
      this.getAllWeekResults(year),
      this.getTeams(year - 1),
      this.getTeams(year - 2),
      this.getAllWeekResults(year - 1),
      this.getAllWeekResults(year - 2),
    ]);

    if (!teamsResult.success && !weeksResult.success) {
      return failure(`Unable to load scorecard data for ${year}`, 'NO_DATA');
    }

    const teams: Team[] = teamsResult.success ? (teamsResult.data ?? []) : [];
    const weekResults: WeekResult[] = weeksResult.success ? (weeksResult.data ?? []) : [];
    const prior1Teams: Team[] = prior1TeamsResult.success ? prior1TeamsResult.data : [];
    const prior2Teams: Team[] = prior2TeamsResult.success ? prior2TeamsResult.data : [];
    const prior1Weeks: WeekResult[] = prior1WeeksResult.success ? prior1WeeksResult.data : [];
    const prior2Weeks: WeekResult[] = prior2WeeksResult.success ? prior2WeeksResult.data : [];

    const prior1AvgMap = buildPriorAvgMap(prior1Weeks, prior1Teams);
    const prior2AvgMap = buildPriorAvgMap(prior2Weeks, prior2Teams);

    const teamDocMap = new Map<string, Team>();
    for (const team of teams) teamDocMap.set(team.name, team);

    const teamNamesFromWeeks = new Set<string>();
    for (const wr of weekResults) {
      for (const tr of wr.teamResults ?? []) teamNamesFromWeeks.add(tr.teamName);
    }

    const orderedTeamNames: string[] = [];
    for (const team of teams) {
      orderedTeamNames.push(team.name);
      teamNamesFromWeeks.delete(team.name);
    }
    for (const name of teamNamesFromWeeks) orderedTeamNames.push(name);

    const blocks = orderedTeamNames.map((teamName) =>
      buildScorecardTeamBlock({
        teamName,
        teamDoc: teamDocMap.get(teamName),
        weekResults,
        prior1Teams,
        prior2Teams,
        prior1AvgMap,
        prior2AvgMap,
      }),
    );

    return success({ year, teams: blocks });
  }

  async deleteTeam(year: number, teamId: string): Promise<Result<void>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!teamId) return failure('teamId is required', 'VALIDATION_ERROR');

    const result = await this.repository.deleteTeam(year, teamId);
    if (!result.success) return result;

    this.cache.delete(`teams:${year}`);
    this.cache.delete(`weeks:${year}`);
    this.cache.delete(`latest:${year}`);
    this.cache.delete(`season:${year}`);
    for (let w = 1; w <= 15; w++) this.cache.delete(`week:${year}:${w}`);

    // Recompute standings from the updated week docs (deleted team already
    // removed by repo). The team IS deleted at this point, so a follow-up
    // failure must not read as "delete failed" — it returns the dedicated
    // STANDINGS_RECOMPUTE_FAILED code so the UI can say "deleted, but
    // standings are stale — retry" (F-25).
    const weeksResult = await this.repository.getAllWeekResults(year);
    if (!weeksResult.success) {
      return failure(
        `Team deleted, but standings recompute failed: ${weeksResult.error}`,
        'STANDINGS_RECOMPUTE_FAILED',
      );
    }
    if (weeksResult.data.length > 0) {
      const newStandings = recomputeStandingsFromWeeks(weeksResult.data);
      const update = await this.repository.updateSeason(year, { standings: newStandings } as Partial<Season>);
      this.cache.delete(`season:${year}`);
      if (!update.success) {
        return failure(
          `Team deleted, but standings recompute failed: ${update.error}`,
          'STANDINGS_RECOMPUTE_FAILED',
        );
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

    // Compute accolade patches: remove the shooter's accolades from any published weeks.
    // Nothing has been written yet, so a failed read is a clean hard failure —
    // proceeding would silently skip the accolade cleanup (F-25).
    const weekAccoladePatches: { weekNumber: number; accolades: NonNullable<WeekResult['accolades']> }[] = [];
    const weeksResult = await this.repository.getAllWeekResults(year);
    if (!weeksResult.success) return weeksResult;
    for (const wr of weeksResult.data) {
      if (!wr.accolades || wr.accolades.length === 0) continue;
      const filtered = wr.accolades.filter(
        (a) => normalizeShooterName(a.shooterName) !== normalizedTarget,
      );
      if (filtered.length !== wr.accolades.length) {
        weekAccoladePatches.push({ weekNumber: wr.weekNumber, accolades: filtered });
      }
    }

    const writeResult = await this.repository.removeShooterFromRosterAndEntries(
      year,
      teamId,
      updatedShooters,
      entryUpdates,
      weekAccoladePatches,
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

  async saveWeekDateOverride(
    year: number,
    weekNumber: number,
    date: string | null,
  ): Promise<Result<void>> {
    if (!Number.isInteger(year) || year < 2019 || year > 2100) {
      return failure(`Invalid year: ${year}`, 'VALIDATION_ERROR');
    }
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 15) {
      return failure(`Invalid weekNumber: ${weekNumber} (must be 1–15)`, 'VALIDATION_ERROR');
    }

    const seasonResult = await this.getSeason(year);
    if (!seasonResult.success) return { success: false, error: seasonResult.error, code: seasonResult.code };
    const existing = seasonResult.data?.weekDateOverrides ?? {};
    const updated = { ...existing, [String(weekNumber)]: date };
    const result = await this.repository.updateSeason(year, { weekDateOverrides: updated } as Partial<Season>);
    if (result.success) {
      this.cache.delete(`season:${year}`);
      this.cache.delete('seasons:all');
    }
    return result.success ? { success: true, data: undefined } : result;
  }

  // -------------------------------------------------------------------------
  // Announcements
  // -------------------------------------------------------------------------

  async getAnnouncements(year: number): Promise<Result<Announcement[]>> {
    const cacheKey = `announcements:${year}`;
    const cached = getCached<Announcement[]>(this.cache, cacheKey);
    if (cached !== undefined) return success(cached);

    const result = await this.repository.getAnnouncements(year);
    if (result.success) setCache(this.cache, cacheKey, result.data);
    return result;
  }

  async createAnnouncement(year: number, title: string, body: string): Promise<Result<Announcement>> {
    const result = await this.repository.createAnnouncement(year, title, body);
    if (result.success) this.cache.delete(`announcements:${year}`);
    return result;
  }

  async updateAnnouncement(id: string, year: number, title: string, body: string): Promise<Result<Announcement>> {
    const result = await this.repository.updateAnnouncement(id, title, body);
    if (result.success) this.cache.delete(`announcements:${year}`);
    return result;
  }

  async deleteAnnouncement(id: string, year: number): Promise<Result<void>> {
    const result = await this.repository.deleteAnnouncement(id);
    if (result.success) this.cache.delete(`announcements:${year}`);
    return result;
  }

  // -------------------------------------------------------------------------
  // Banner
  // -------------------------------------------------------------------------

  async getBanner(): Promise<Result<string | null>> {
    return this.repository.getBanner();
  }

  async setBanner(message: string | null): Promise<Result<void>> {
    return this.repository.setBanner(message?.trim() || null);
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

