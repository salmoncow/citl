/**
 * Tab module contracts for <admin-panel>.
 *
 * The shell (`src/components/admin-panel.ts`) owns shared state — current
 * year, teams cache, season cache, name suggestion caches — and notifies
 * each tab of relevant changes via the lifecycle hooks below. Tabs render
 * their own DOM into a host `<div>` provided at mount time.
 */

import type { Team } from '@/types/score';
import type { Season } from '@/types/season';

export interface ConfirmDialogOptions {
  title: string;
  warning: string;
  nameToType: string;
  deleteLabel: string;
}

export interface AdminTabContext {
  /** Current year selected in the shared #ap-year selector. */
  getYear(): number;
  /** Cached teams for the current year (null until first refresh). */
  getTeamsData(): Team[] | null;
  /** Cached season metadata for the current year (null until first refresh). */
  getSeasonData(): Season | null;
  /** Refetch teams and notify all tabs that teams data changed. */
  refreshTeams(): Promise<void>;
  /** Refetch season metadata and notify all tabs that season data changed. */
  refreshSeason(): Promise<void>;
  /** Suggestion list of shooter names across the current + 2 prior years. */
  getShooterSuggestions(year: number): Promise<string[]>;
  /** Suggestion list of team names across the current + 2 prior years. */
  getTeamNameSuggestions(year: number): Promise<string[]>;
  /** Synchronously read shooter names from the cached current-year teams. */
  getCurrentYearShooterNames(): string[];
  /** Synchronously read cached team-name suggestions (or current-year teams as fallback). */
  getTeamNames(): string[];
  /** Synchronously read the cached cross-year shooter suggestions (no fetch). */
  getCachedShooterNames(): string[];
}

export interface AdminTab {
  /** Render initial DOM into `host` and attach event listeners. */
  mount(host: HTMLElement, ctx: AdminTabContext): void;
  /** Year selector changed — reset transient state, refresh local data. */
  onYearChange?(): void;
  /** Teams cache was refetched — re-render dependent UI. */
  onTeamsChanged?(): void;
  /** Season cache was refetched — re-render dependent UI. */
  onSeasonChanged?(): void;
  /** Tab became the active visible tab. */
  onActivate?(): void;
}
