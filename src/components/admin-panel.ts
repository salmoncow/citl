/**
 * <admin-panel> — Custom Element
 *
 * Thin app shell (spec 006 DD-12): sidebar navigation, a top bar with the
 * page title and year selector, and shared
 * data caches (teams, season, name suggestions). Delegates each tab's
 * rendering and behavior to a tab module under `./admin-tabs/`.
 *
 * Tabs:
 *   - Team Management — team list with inline editing + roster modal
 *   - Score Entry     — weekly entry form, date override, publish
 *   - Announcements   — site banner + per-year announcements
 *   - Season End      — preview + finalize season awards (spec 004)
 *   - Users           — hosts <admin-users-panel> (owner-only dropdown)
 *
 * No shadow DOM. All user values rendered via textContent (never innerHTML),
 * except static SVG icon markup defined in `admin-tabs/admin-shared.ts`.
 */

import './admin-users-panel';
import { getServices } from '@/services/app-services';
import { normalizeShooterName } from '@/services/scoring-engine';
import type { Team } from '@/types/score';
import type { Season } from '@/types/season';
import { buildOptions } from './admin-tabs/admin-shared';
import { TeamManagementTab } from './admin-tabs/team-management-tab';
import { ScoreEntryTab } from './admin-tabs/score-entry-tab';
import { AnnouncementsTab } from './admin-tabs/announcements-tab';
import { SeasonEndTab } from './admin-tabs/season-end-tab';
import type { AdminTab, AdminTabContext } from './admin-tabs/types';

const { scoreService, seasonAwardsService } = getServices();

const CURRENT_YEAR = new Date().getFullYear();

type TabName = 'team-mgmt' | 'score-entry' | 'announcements' | 'season-end' | 'users';

class AdminPanel extends HTMLElement {
  private _teamsData: Team[] | null = null;
  private _seasonData: Season | null = null;
  private _shooterNameCache: { year: number; names: string[] } | null = null;
  private _teamNameCache: { year: number; names: string[] } | null = null;

  private readonly _teamMgmtTab = new TeamManagementTab(scoreService);
  private readonly _scoreEntryTab = new ScoreEntryTab(scoreService);
  private readonly _announcementsTab = new AnnouncementsTab(scoreService);
  private readonly _seasonEndTab = new SeasonEndTab(seasonAwardsService);

  /** All tabs that implement the AdminTab lifecycle (excludes self-managed Users tab). */
  private get _lifecycleTabs(): AdminTab[] {
    return [this._teamMgmtTab, this._scoreEntryTab, this._announcementsTab, this._seasonEndTab];
  }

  connectedCallback(): void {
    const navItem = (tab: TabName, label: string, icon: string, active = false): string => `
      <button type="button" class="admin-tab-btn${active ? ' is-active' : ''}" data-tab="${tab}"${active ? ' aria-current="page"' : ''}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${icon}"/></svg>
        <span>${label}</span>
      </button>`;

    this.innerHTML = `
      <aside class="admin-sidebar on-dark">
        <a href="#/" class="admin-brand" aria-label="CITL — back to the public site">
          <svg width="28" height="28" viewBox="0 0 34 34" aria-hidden="true" focusable="false"><circle cx="17" cy="17" r="15" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="17" cy="17" r="8" fill="currentColor"/></svg>
          <span class="admin-brand__word">CITL</span>
          <span class="admin-brand__tag">Admin</span>
        </a>
        <nav class="admin-nav admin-tabs" aria-label="Admin">
          ${navItem('team-mgmt', 'Team Management', 'M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', true)}
          ${navItem('score-entry', 'Score Entry', 'M4 4h16v16H4zM4 10h16M10 4v16')}
          ${navItem('announcements', 'Announcements', 'M3 11l15-6v14L3 13zM7 12v6')}
          ${navItem('season-end', 'Season End', 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z')}
          ${navItem('users', 'Users', 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z')}
        </nav>
      </aside>

      <div class="admin-main">
        <div class="admin-topbar">
          <div class="admin-topbar__title">
            <span class="eyebrow">Admin</span>
            <h1 id="ap-title">Team Management</h1>
          </div>
          <div id="ap-year-row" class="admin-form-row">
            <label for="ap-year">Season</label>
            <select id="ap-year">${buildOptions(2019, 2030, '', CURRENT_YEAR)}</select>
          </div>
        </div>

        <div class="admin-content">
          <div id="ap-panel-team-mgmt" class="admin-tab-content"></div>
          <div id="ap-panel-score-entry" class="admin-tab-content admin-tab-panel--hidden"></div>
          <div id="ap-panel-announcements" class="admin-tab-content admin-tab-panel--hidden"></div>
          <div id="ap-panel-season-end" class="admin-tab-content admin-tab-panel--hidden"></div>
          <div id="ap-panel-users" class="admin-tab-content admin-tab-panel--hidden">
            <admin-users-panel></admin-users-panel>
          </div>
        </div>
      </div>`;

    const ctx = this._buildContext();
    this._teamMgmtTab.mount(this.querySelector<HTMLElement>('#ap-panel-team-mgmt')!, ctx);
    this._scoreEntryTab.mount(this.querySelector<HTMLElement>('#ap-panel-score-entry')!, ctx);
    this._announcementsTab.mount(this.querySelector<HTMLElement>('#ap-panel-announcements')!, ctx);
    this._seasonEndTab.mount(this.querySelector<HTMLElement>('#ap-panel-season-end')!, ctx);

    for (const btn of this.querySelectorAll<HTMLButtonElement>('.admin-tab-btn')) {
      btn.addEventListener('click', () => this._switchTab((btn.dataset['tab'] ?? '') as TabName));
    }

    this.querySelector('#ap-year')!.addEventListener('change', () => {
      this._shooterNameCache = null;
      this._teamNameCache = null;
      void this._refreshTeams();
      void this._refreshSeason();
      for (const tab of this._lifecycleTabs) tab.onYearChange?.();
      void this._getTeamNameSuggestions(this._getYear());
    });

    void this._refreshTeams();
    void this._refreshSeason();
    void this._getTeamNameSuggestions(CURRENT_YEAR);
  }

  // ── Tab switching ────────────────────────────────────────────────────────

  private _switchTab(tab: TabName): void {
    for (const btn of this.querySelectorAll<HTMLButtonElement>('.admin-tab-btn')) {
      const on = btn.dataset['tab'] === tab;
      btn.classList.toggle('is-active', on);
      if (on) {
        btn.setAttribute('aria-current', 'page');
        this.querySelector('#ap-title')!.textContent = btn.textContent?.trim() ?? '';
      } else {
        btn.removeAttribute('aria-current');
      }
    }
    for (const { id, name } of [
      { id: 'ap-panel-team-mgmt', name: 'team-mgmt' },
      { id: 'ap-panel-score-entry', name: 'score-entry' },
      { id: 'ap-panel-announcements', name: 'announcements' },
      { id: 'ap-panel-season-end', name: 'season-end' },
      { id: 'ap-panel-users', name: 'users' },
    ]) {
      const el = this.querySelector(`#${id}`);
      if (el) el.classList.toggle('admin-tab-panel--hidden', name !== tab);
    }

    const yearRow = this.querySelector<HTMLElement>('#ap-year-row');
    if (yearRow) yearRow.classList.toggle('admin-form-row--hidden', tab === 'users');

    if (tab === 'score-entry') this._scoreEntryTab.onActivate?.();
    else if (tab === 'announcements') this._announcementsTab.onActivate?.();
    else if (tab === 'season-end') this._seasonEndTab.onActivate?.();
  }

  // ── Shared data refresh ──────────────────────────────────────────────────

  private async _refreshTeams(): Promise<void> {
    const result = await scoreService.getTeams(this._getYear());
    if (result.success) {
      this._teamsData = result.data;
    } else {
      console.warn('admin-panel: could not load teams data:', result.error);
      this._teamsData = [];
    }
    for (const tab of this._lifecycleTabs) tab.onTeamsChanged?.();
  }

  private async _refreshSeason(): Promise<void> {
    const result = await scoreService.getSeason(this._getYear());
    this._seasonData = (result.success ? result.data : null) ?? null;
    for (const tab of this._lifecycleTabs) tab.onSeasonChanged?.();
  }

  // ── Year + suggestion helpers ────────────────────────────────────────────

  private _getYear(): number {
    return parseInt(this.querySelector<HTMLSelectElement>('#ap-year')!.value, 10);
  }

  private async _getTeamNameSuggestions(year: number): Promise<string[]> {
    if (this._teamNameCache?.year === year) return this._teamNameCache.names;

    const [cur, prior1, prior2] = await Promise.all([
      scoreService.getTeams(year),
      scoreService.getTeams(year - 1),
      scoreService.getTeams(year - 2),
    ]);

    const seen = new Map<string, string>();
    for (const result of [cur, prior1, prior2]) {
      if (!result.success) continue;
      for (const team of result.data) {
        const key = team.name.toLowerCase().trim();
        if (!seen.has(key)) seen.set(key, team.name);
      }
    }

    const names = [...seen.values()].sort((a, b) => a.localeCompare(b));
    this._teamNameCache = { year, names };
    return names;
  }

  private async _getShooterSuggestions(year: number): Promise<string[]> {
    if (this._shooterNameCache?.year === year) return this._shooterNameCache.names;

    const [cur, prior1, prior2] = await Promise.all([
      scoreService.getTeams(year),
      scoreService.getTeams(year - 1),
      scoreService.getTeams(year - 2),
    ]);

    const seen = new Map<string, string>();
    // Process most recent year first so its casing wins
    for (const result of [cur, prior1, prior2]) {
      if (!result.success) continue;
      for (const team of result.data) {
        for (const s of team.shooters) {
          const key = normalizeShooterName(s.name);
          if (!seen.has(key)) seen.set(key, s.name);
        }
      }
    }

    const names = [...seen.values()].sort((a, b) => a.localeCompare(b));
    this._shooterNameCache = { year, names };
    return names;
  }

  private _getCurrentYearShooterNames(): string[] {
    if (!this._teamsData) return [];
    const seen = new Map<string, string>();
    for (const team of this._teamsData) {
      for (const s of team.shooters) {
        const key = normalizeShooterName(s.name);
        if (!seen.has(key)) seen.set(key, s.name);
      }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }

  private _getTeamNames(): string[] {
    return this._teamNameCache?.names ?? this._teamsData?.map((t) => t.name) ?? [];
  }

  // ── Tab context factory ──────────────────────────────────────────────────

  private _buildContext(): AdminTabContext {
    return {
      getYear: () => this._getYear(),
      getTeamsData: () => this._teamsData,
      getSeasonData: () => this._seasonData,
      refreshTeams: () => this._refreshTeams(),
      refreshSeason: () => this._refreshSeason(),
      getShooterSuggestions: (year) => this._getShooterSuggestions(year),
      getTeamNameSuggestions: (year) => this._getTeamNameSuggestions(year),
      getCurrentYearShooterNames: () => this._getCurrentYearShooterNames(),
      getTeamNames: () => this._getTeamNames(),
      getCachedShooterNames: () => this._shooterNameCache?.names ?? [],
    };
  }
}

if (!customElements.get('admin-panel')) {
  customElements.define('admin-panel', AdminPanel);
}
