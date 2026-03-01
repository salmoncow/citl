/**
 * ScoreService — business logic for shooter scores
 *
 * Wraps ScoreRepository with:
 *   - 1-hour in-memory cache for season / team data
 *   - Input validation
 *   - Result pattern (never throws across module boundaries)
 */

import { success, failure, type Result } from '@/repositories/score-repository';
import { computeSeasonTotals } from '@/services/scoring-engine';
import type { ScoreRepository } from '@/repositories/score-repository';
import type { Season, SeasonStandings } from '@/types/season';
import type { Team, WeekResult, SeasonEntry } from '@/types/score';
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
        (s) => s.name.toUpperCase().includes('DUMMY'),
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
      return {
        teamId: _slugify(team.name),
        teamName: team.name,
        targets: team.totals.targets[wi] ?? 0,
        rankPoints: team.totals.rankPoints[wi] ?? 0,
        bonusPoints: team.totals.bonusPoints[wi] ?? 0,
        shooterScores: teamEntry ? teamEntry.shooters : [],
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
        isDummy: rs.name.toUpperCase().includes('DUMMY'),
        startingAvg: rs.startingAvg ?? 35,
        scores: new Array<number | null>(WEEK_COUNT).fill(null),
        weeksShot: null,
        finalAvg: 0,
      };
    });

    const subShooters: ScorecardShooter[] = [...seenNames].map((name) => ({
      name,
      rookie: false,
      isDummy: name.toUpperCase().includes('DUMMY'),
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
