/**
 * home-standings-parts — pure HTML builders for the blocks home-standings
 * shows above its table: finalized season awards and weekly accolades.
 * Icons are inline stroke SVGs (spec 006 replaces the ADR-008 emoji).
 */

import { escapeHtml } from '@/modules/ui';
import type { SeasonAwards } from '@/types/season';
import type { Accolade } from '@/types/shooter';

const ICON_TROPHY = '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>';
const ICON_TARGET = '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>';
const ICON_STAR = '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>';
const ICON_TREND = '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>';

function icon(paths: string): string {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

/**
 * Season award cards. Each field is null-guarded independently (repository
 * reads are unvalidated casts); cards with a missing winner are omitted and
 * the whole block is omitted when none render (spec 004 DD-2).
 */
export function renderSeasonAwards(awards: SeasonAwards): string {
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const cards: { icon: string; award: string; winner: string; result: string; lead?: boolean }[] = [];

  if (typeof awards.firstPlaceTeam === 'string') {
    cards.push({
      icon: ICON_TROPHY, award: 'Champions', winner: awards.firstPlaceTeam, lead: true,
      result: num(awards.firstPlacePoints) ? `${awards.firstPlacePoints} pts` : '—',
    });
  }
  if (typeof awards.secondPlaceTeam === 'string') {
    cards.push({
      icon: ICON_TROPHY, award: 'Second place', winner: awards.secondPlaceTeam,
      result: num(awards.secondPlacePoints) ? `${awards.secondPlacePoints} pts` : '—',
    });
  }
  if (typeof awards.highestAvgShooter === 'string') {
    cards.push({
      icon: ICON_TARGET, award: 'Top Gun', winner: awards.highestAvgShooter,
      result: num(awards.highestAvg) ? `${awards.highestAvg.toFixed(2)} avg` : '—',
    });
  }
  if (typeof awards.rookieOfYear === 'string') {
    cards.push({
      icon: ICON_STAR, award: 'Rookie of the Year', winner: awards.rookieOfYear,
      result: num(awards.rookieAvg) ? `${awards.rookieAvg.toFixed(2)} avg` : '—',
    });
  }
  if (typeof awards.mostImproved === 'string') {
    cards.push({
      icon: ICON_TREND, award: 'Most Improved', winner: awards.mostImproved,
      result: typeof awards.improvement === 'string' ? awards.improvement : '—',
    });
  }
  if (cards.length === 0) return '';

  const items = cards.map((c) => `
      <li class="award-card${c.lead ? ' award-card--lead' : ''}">
        <span class="award-card__icon">${icon(c.icon)}</span>
        <span class="award-card__label">${escapeHtml(c.award)}</span>
        <span class="award-card__winner">${escapeHtml(c.winner)}</span>
        <span class="award-card__result num">${escapeHtml(c.result)}</span>
      </li>`).join('');

  return `
    <div class="awards-section">
      <h3 class="awards-section__heading">Season awards</h3>
      <ul class="award-grid">${items}</ul>
    </div>`;
}

/** Straight-25 / straight-50 chips for the selected week. */
export function renderAccolades(accolades: Accolade[], weekNumber: number): string {
  if (accolades.length === 0) return '';
  const items = accolades.map((a) => {
    const fifty = a.streak === 50;
    return `
      <li class="accolade${fifty ? ' accolade--50' : ''}">
        <span class="accolade__badge">${fifty ? 'Straight 50' : 'Straight 25'}</span>
        <span class="accolade__name">${escapeHtml(a.shooterName)}</span>
        <span class="accolade__team">${escapeHtml(a.teamName)}</span>
      </li>`;
  }).join('');
  return `
    <div class="accolades-section">
      <h3 class="accolades-section__heading">Week ${weekNumber} accolades</h3>
      <ul class="accolades-list">${items}</ul>
    </div>`;
}
