/**
 * home-award-races — Custom Element
 *
 * Mid-season leaderboards for the three individual awards (Top Gun, Rookie
 * of the Year, Most Improved) — spec 006. Starting averages and rookie status
 * need prior-season data (buildScorecardData), so this section loads lazily,
 * only once it scrolls near the viewport. It renders nothing for a finalized
 * season (home-standings shows the official awards) or when no shooter has
 * enough nights yet.
 */

import { getServices } from '@/services/app-services';
import { toAwardShooterInputs } from '@/services/scorecard-builder';
import { AWARD_MIN_NIGHTS, computeAwardRaces } from '@/services/season-highlights';
import type { RaceEntry } from '@/services/season-highlights';
import { escapeHtml } from '@/modules/ui';

const { scoreService } = getServices();

class HomeAwardRaces extends HTMLElement {
  private _observer: IntersectionObserver | null = null;

  connectedCallback(): void {
    if (!('IntersectionObserver' in window)) {
      void this._load();
      return;
    }
    this._observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        this._disconnect();
        void this._load();
      }
    }, { rootMargin: '400px 0px' });
    this._observer.observe(this);
  }

  disconnectedCallback(): void {
    this._disconnect();
  }

  private _disconnect(): void {
    this._observer?.disconnect();
    this._observer = null;
  }

  private async _load(): Promise<void> {
    const seasons = await scoreService.getAllSeasons();
    const season = seasons.success ? seasons.data[0] : undefined;
    if (!season || season.status === 'complete' || (season.currentWeek ?? 0) < 1) return;

    this.innerHTML = HomeAwardRaces._skeleton();
    const view = await scoreService.buildScorecardData(season.year);
    if (!view.success) {
      this.innerHTML = '';
      return;
    }
    const races = computeAwardRaces(toAwardShooterInputs(view.data.teams));
    if (races.topGun.length === 0) {
      this.innerHTML = '';
      return;
    }
    this.innerHTML = `
      <section class="section award-races" aria-labelledby="races-title">
        <div class="section-head">
          <div>
            <span class="eyebrow">Individual awards</span>
            <h2 id="races-title">Award races</h2>
          </div>
          <p class="section-head__meta">Award eligibility: ${AWARD_MIN_NIGHTS} nights shot. Standings are provisional until season end.</p>
        </div>
        <div class="race-grid">
          ${HomeAwardRaces._card('Top Gun', 'Highest average', races.topGun, (v) => v.toFixed(1))}
          ${HomeAwardRaces._card('Rookie of the Year', 'Highest rookie average', races.rookie, (v) => v.toFixed(1))}
          ${HomeAwardRaces._card('Most Improved', 'Share of possible improvement', races.mostImproved, (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`)}
        </div>
      </section>`;
  }

  private static _card(title: string, sub: string, entries: RaceEntry[], fmt: (v: number) => string): string {
    const rows = entries.length
      ? entries.map((e, i) => `
          <li class="race-row">
            <span class="race-row__pos">${i + 1}</span>
            <span class="race-row__who">
              <span class="race-row__name">${escapeHtml(e.name)}</span>
              <span class="race-row__team">${escapeHtml(e.teamName)}${e.eligible ? '' : ` · ${e.nights} of ${AWARD_MIN_NIGHTS} nights`}</span>
            </span>
            <span class="race-row__val num">${fmt(e.value)}</span>
          </li>`).join('')
      : '<li class="race-row race-row--empty">No qualifying shooters yet.</li>';
    return `
      <div class="race-card">
        <h3 class="race-card__title">${title}</h3>
        <p class="race-card__sub">${sub}</p>
        <ol class="race-list">${rows}</ol>
      </div>`;
  }

  private static _skeleton(): string {
    const card = `
      <div class="race-card skeleton-group">
        <span class="skeleton skeleton--lg" style="width:60%"></span>
        <span class="skeleton skeleton--md" style="width:100%"></span>
        <span class="skeleton skeleton--md" style="width:100%"></span>
        <span class="skeleton skeleton--md" style="width:100%"></span>
      </div>`;
    return `<div class="section race-grid">${card.repeat(3)}</div>`;
  }
}

customElements.define('home-award-races', HomeAwardRaces);
