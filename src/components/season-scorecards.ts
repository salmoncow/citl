/**
 * season-scorecards — Custom Element
 *
 * Scorecards page (spec 006 DD-10): season chips (a select on phones), team
 * tabs following the ARIA APG tabs pattern, and one panel per team with a
 * summary strip, heat grid and mobile shooter cards. Every panel is rendered
 * (inactive ones `hidden`) so print still shows all teams.
 * No shadow DOM; uses global CSS classes.
 */

import { getServices } from '@/services/app-services';
import { summarizeScorecardTeams } from '@/services/scorecard-builder';
import { escapeHtml } from '@/modules/ui';
import { renderTeamPanel } from '@/components/scorecard-render';
import type { Season } from '@/types/season';
import type { ScorecardTeamBlock } from '@/types/scorecard';

const { scoreService } = getServices();

class SeasonScorecards extends HTMLElement {
  private _seasons: Season[] = [];
  /** Re-entrancy guard: only the latest _loadYear call may render (F-23). */
  private _loadGen = 0;

  connectedCallback(): void {
    this.innerHTML = `
      <div class="season-scorecards">
        <div class="page-head">
          <div>
            <span class="eyebrow" id="sc-eyebrow">Scorecards</span>
            <h1 id="sc-title">Scorecards</h1>
          </div>
          <div class="page-head__actions">
            <button type="button" class="btn-secondary" id="sc-print">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z"/></svg>
              Print
            </button>
          </div>
        </div>
        <div class="sc-controls">
          <div class="chip-row sc-season-chips" role="group" aria-label="Season" id="sc-chips"></div>
          <label class="field-inline sc-season-select">Season <select id="sc-year"></select></label>
        </div>
        <div id="sc-content">${SeasonScorecards._skeleton()}</div>
      </div>`;

    this.querySelector('#sc-print')!.addEventListener('click', () => window.print());
    this.querySelector<HTMLSelectElement>('#sc-year')!.addEventListener('change', (e) => {
      this._selectYear(parseInt((e.target as HTMLSelectElement).value, 10));
    });
    this.querySelector('#sc-chips')!.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-year]');
      if (chip) this._selectYear(parseInt(chip.dataset['year'] ?? '', 10));
    });
    const content = this.querySelector<HTMLElement>('#sc-content')!;
    content.addEventListener('click', (e) => {
      const tab = (e.target as HTMLElement).closest<HTMLButtonElement>('[role="tab"]');
      if (tab) this._activateTab(tab, false);
    });
    content.addEventListener('keydown', (e) => this._onTabKeydown(e));

    void this._loadSeasons();
  }

  private _setContent(html: string): void {
    this.querySelector('#sc-content')!.innerHTML = html;
  }

  private async _loadSeasons(): Promise<void> {
    const result = await scoreService.getAllSeasons();
    if (!result.success) {
      this._setContent('<p class="state-msg">Error loading seasons.</p>');
      return;
    }
    this._seasons = result.data ?? [];
    const select = this.querySelector<HTMLSelectElement>('#sc-year')!;
    const chips = this.querySelector('#sc-chips')!;
    for (const season of this._seasons) {
      const opt = document.createElement('option');
      opt.value = String(season.year);
      opt.textContent = String(season.year);
      select.appendChild(opt);

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip chip--mono';
      chip.dataset['year'] = String(season.year);
      chip.textContent = String(season.year);
      chips.appendChild(chip);
    }
    const latest = this._seasons[0];
    if (!latest) {
      this._setContent('<p class="state-msg">No seasons available.</p>');
      return;
    }
    this._selectYear(latest.year);
  }

  private _selectYear(year: number): void {
    if (!Number.isInteger(year)) return;
    this.querySelector<HTMLSelectElement>('#sc-year')!.value = String(year);
    for (const chip of this.querySelectorAll<HTMLButtonElement>('#sc-chips button')) {
      chip.setAttribute('aria-pressed', String(chip.dataset['year'] === String(year)));
    }
    void this._loadYear(year);
  }

  private async _loadYear(year: number): Promise<void> {
    const gen = ++this._loadGen;
    this._setContent(SeasonScorecards._skeleton());

    const [result, teamsResult] = await Promise.all([
      scoreService.buildScorecardData(year),
      scoreService.getTeams(year),
    ]);
    if (gen !== this._loadGen) return; // superseded by a newer selection
    if (!result.success) {
      this._setContent(`<p class="state-msg">Error loading scorecard data for ${year}.</p>`);
      return;
    }

    const season = this._seasons.find((s) => s.year === year);
    const published = season?.status === 'complete' ? 15 : (season?.currentWeek ?? 0);
    this.querySelector('#sc-title')!.textContent = `${year} Season`;
    this.querySelector('#sc-eyebrow')!.textContent =
      season?.status === 'complete' ? 'Scorecards · Final' : `Scorecards · Through week ${published}`;

    const blocks = result.data.teams;
    if (blocks.length === 0) {
      this._setContent(`<p class="state-msg">No scorecard data available for ${year}.</p>`);
      return;
    }

    const placeByName = new Map((season?.standings ?? []).map((s) => [s.teamName, s.rank]));
    const captainByName = new Map(
      (teamsResult.success ? teamsResult.data : []).map((t) => [t.name, t.captain]),
    );
    const summaries = new Map(summarizeScorecardTeams(blocks).map((s) => [s.teamName, s]));
    const ordered = [...blocks].sort(
      (a, b) => (placeByName.get(a.teamName) ?? 999) - (placeByName.get(b.teamName) ?? 999),
    );

    this._setContent(this._render(ordered, placeByName, captainByName, summaries, published));
  }

  private _render(
    blocks: ScorecardTeamBlock[],
    placeByName: Map<string, number>,
    captainByName: Map<string, string>,
    summaries: Map<string, ReturnType<typeof summarizeScorecardTeams>[number]>,
    publishedWeeks: number,
  ): string {
    const tabs = blocks.map((b, i) => {
      const place = placeByName.get(b.teamName);
      return `
        <button type="button" role="tab" class="sc-tab" id="sc-tab-${i}" aria-controls="sc-panel-${i}"
          aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">
          ${place ? `<span class="sc-tab__place">${place}</span>` : ''}
          <span class="sc-tab__name">${escapeHtml(b.teamName)}</span>
        </button>`;
    }).join('');

    const panels = blocks.map((b, i) => `
      <section class="sc-panel" role="tabpanel" id="sc-panel-${i}" aria-labelledby="sc-tab-${i}" ${i === 0 ? '' : 'hidden'}>
        ${renderTeamPanel({
          block: b,
          summary: summaries.get(b.teamName),
          place: placeByName.get(b.teamName) ?? null,
          captain: captainByName.get(b.teamName) ?? null,
          publishedWeeks,
        })}
      </section>`).join('');

    return `
      <div class="sc-tabs" role="tablist" aria-label="Team">${tabs}</div>
      ${panels}`;
  }

  private _tabs(): HTMLButtonElement[] {
    return [...this.querySelectorAll<HTMLButtonElement>('#sc-content [role="tab"]')];
  }

  private _activateTab(tab: HTMLButtonElement, focus: boolean): void {
    for (const t of this._tabs()) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = this.querySelector<HTMLElement>(`#${t.getAttribute('aria-controls') ?? ''}`);
      if (panel) panel.hidden = !on;
    }
    if (focus) tab.focus();
  }

  private _onTabKeydown(e: KeyboardEvent): void {
    const current = (e.target as HTMLElement).closest<HTMLButtonElement>('[role="tab"]');
    if (!current) return;
    const tabs = this._tabs();
    const i = tabs.indexOf(current);
    let next: HTMLButtonElement | undefined;
    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
    else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === 'Home') next = tabs[0];
    else if (e.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    e.preventDefault();
    this._activateTab(next, true);
  }

  private static _skeleton(): string {
    const tab = '<span class="skeleton" style="flex:1;height:56px;border-radius:var(--radius-lg)"></span>';
    return `
      <div class="skeleton-group">
        <div class="skeleton-row">${tab.repeat(4)}</div>
        <span class="skeleton" style="height:120px;border-radius:var(--radius-xl)"></span>
        <span class="skeleton" style="height:320px;border-radius:var(--radius-xl)"></span>
      </div>`;
  }
}

customElements.define('season-scorecards', SeasonScorecards);
