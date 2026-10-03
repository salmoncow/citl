/**
 * Shooter directory (spec 009 AC-16): every roster name across every
 * season, merged by normalizeShooterName, with the seasons and teams it
 * appears on. Feeds the shooter-link search on /account.
 *
 * Built from the ScoreService's cached season and team reads, so a page
 * that already showed scorecards pays nothing extra. Loaded only when the
 * link form opens.
 */

import type { Team } from '@/types/score';
import type { Season } from '@/types/season';
import type { Result } from '@/types/result';
import { normalizeShooterName } from '@/services/scoring-engine';

export interface DirectoryEntry {
  /** The most recent spelling of the name. */
  name: string;
  key: string;
  seasons: number[];
  teams: string[];
}

export function buildShooterDirectory(bySeason: readonly { year: number; teams: readonly Team[] }[]): DirectoryEntry[] {
  const map = new Map<string, { name: string; latest: number; seasons: Set<number>; teams: Set<string> }>();
  for (const { year, teams } of bySeason) {
    for (const team of teams) {
      for (const s of team.shooters) {
        const key = normalizeShooterName(s.name);
        if (!key) continue;
        const cur = map.get(key);
        if (!cur) {
          map.set(key, { name: s.name.trim(), latest: year, seasons: new Set([year]), teams: new Set([team.name]) });
          continue;
        }
        cur.seasons.add(year);
        cur.teams.add(team.name);
        if (year > cur.latest) { cur.latest = year; cur.name = s.name.trim(); }
      }
    }
  }
  return [...map].map(([key, v]) => ({
    name: v.name,
    key,
    seasons: [...v.seasons].sort((a, b) => a - b),
    teams: [...v.teams].sort(),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Names containing every word of the query; exact matches first. */
export function searchDirectory(dir: readonly DirectoryEntry[], query: string, limit = 8): DirectoryEntry[] {
  const q = normalizeShooterName(query);
  if (!q) return [];
  const words = q.split(/\s+/);
  const hits = dir.filter((e) => words.every((w) => e.key.includes(w)));
  hits.sort((a, b) => Number(b.key === q) - Number(a.key === q));
  return hits.slice(0, limit);
}

export interface SeasonTeamSource {
  getAllSeasons(): Promise<Result<Season[]>>;
  getTeams(year: number): Promise<Result<Team[]>>;
}

export async function loadShooterDirectory(source: SeasonTeamSource): Promise<Result<DirectoryEntry[]>> {
  const seasons = await source.getAllSeasons();
  if (!seasons.success) return seasons;
  const results = await Promise.all(seasons.data.map(async (s) => ({ year: s.year, res: await source.getTeams(s.year) })));
  const failed = results.find((r) => !r.res.success);
  if (failed && !failed.res.success) return failed.res;
  return {
    success: true,
    data: buildShooterDirectory(results.map((r) => ({ year: r.year, teams: r.res.success ? r.res.data : [] }))),
  };
}
