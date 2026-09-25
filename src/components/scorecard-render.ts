/**
 * scorecard-render — pure HTML builders for one team's scorecard panel
 * (spec 006 DD-10): dark summary strip, desktop heat grid, and the mobile
 * shooter cards + team-by-week table. All Firestore strings are escaped.
 */

import { escapeHtml } from '@/modules/ui';
import { normalizeShooterName } from '@/services/scoring-engine';
import { HEAT_LEGEND, heatBin } from '@/utils/heat';
import type { ScorecardTeamSummary } from '@/services/scorecard-builder';
import type { ScorecardRowShooter, ScorecardTeamBlock } from '@/types/scorecard';

const WEEKS = 15;

export interface TeamPanelInput {
  block: ScorecardTeamBlock;
  summary: ScorecardTeamSummary | undefined;
  place: number | null;
  captain: string | null;
  /** Weeks 1..publishedWeeks have been played; later weeks render as empty slots. */
  publishedWeeks: number;
}

const fmt = (v: number | string | null | undefined): string =>
  v === null || v === undefined || v === '-' ? '–' : String(v);

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function visibleShooters(block: ScorecardTeamBlock): ScorecardRowShooter[] {
  // Padding dummies that never shot carry no information — omit them.
  return block.shooters.filter((s) => !(s.isDummy && s.weeksShot === null));
}

function isCaptain(s: ScorecardRowShooter, captain: string | null): boolean {
  return captain !== null && normalizeShooterName(s.name) === normalizeShooterName(captain);
}

function badges(s: ScorecardRowShooter, captain: string | null): string {
  const out: string[] = [];
  if (isCaptain(s, captain)) out.push('<span class="badge badge--solid" title="Captain">C</span>');
  if (s.rookie) out.push('<span class="badge badge--accent" title="Rookie">R</span>');
  return out.join('');
}

function heatCell(score: number | null, week: number, publishedWeeks: number): string {
  if (week > publishedWeeks) return '<span class="heat heat--future" aria-label="Not shot yet"></span>';
  if (score === null) return '<span class="heat heat--dns" title="Did not shoot">–</span>';
  const straight = score === 50;
  return `<span class="heat heat--${heatBin(score)}${straight ? ' heat--straight' : ''}" title="Week ${week}: ${score} of 50">${score}${straight ? '<span class="visually-hidden"> (straight 50)</span>' : ''}</span>`;
}

export function renderSummary(input: TeamPanelInput, rookies: number, shooters: number): string {
  const { block, summary, place, captain } = input;
  const metrics = summary
    ? [
        { k: 'Points', v: String(summary.rankPoints + summary.bonusPoints), sub: place ? `${ordinal(place)} place` : '' },
        { k: 'Targets', v: summary.totalTargets.toLocaleString('en-US'), sub: summary.nightsShot ? `${(summary.totalTargets / summary.nightsShot).toFixed(1)} / night` : '' },
        { k: 'Rank pts', v: String(summary.rankPoints), sub: `${summary.weeklyWins} weekly ${summary.weeklyWins === 1 ? 'win' : 'wins'}` },
        { k: 'Bonus', v: String(summary.bonusPoints), sub: `Beat avg ${summary.beatAverageWeeks} of ${summary.nightsShot}` },
      ]
    : [];
  const meta = [
    captain ? `Captain ${escapeHtml(captain)}` : '',
    `${shooters} shooters`,
    rookies ? `${rookies} ${rookies === 1 ? 'rookie' : 'rookies'}` : '',
  ].filter(Boolean).join(' · ');

  return `
    <div class="sc-summary on-dark">
      <div class="sc-summary__team">
        ${place ? `<span class="pos pos--${Math.min(place, 4)} sc-summary__pos">${place}</span>` : ''}
        <div>
          <h2 class="sc-summary__name">${escapeHtml(block.teamName)}</h2>
          <p class="sc-summary__meta">${meta}</p>
        </div>
      </div>
      <dl class="sc-summary__metrics">
        ${metrics.map((m) => `
          <div class="sc-metric">
            <dt>${m.k}</dt>
            <dd><span class="num">${m.v}</span><span class="sc-metric__sub">${m.sub}</span></dd>
          </div>`).join('')}
      </dl>
    </div>`;
}

export function renderHeatGrid(input: TeamPanelInput): string {
  const { block, captain, publishedWeeks } = input;
  const weekHeads = Array.from({ length: WEEKS }, (_, i) =>
    `<th scope="col" class="sc-wk${i + 1 > publishedWeeks ? ' sc-wk--future' : ''}">W${i + 1}</th>`).join('');

  const rows = visibleShooters(block).map((s) => `
    <tr${s.isDummy ? ' class="sc-row--dummy"' : ''}>
      <th scope="row" class="sc-name"><span>${escapeHtml(s.name)}</span>${badges(s, captain)}</th>
      <td class="num sc-start">${fmt(s.w0Display)}</td>
      ${s.scores.slice(0, WEEKS).map((v, i) => `<td class="sc-cell">${heatCell(v, i + 1, publishedWeeks)}</td>`).join('')}
      <td class="num sc-shot">${fmt(s.weeksShot)}</td>
      <td class="num sc-avg">${fmt(s.finalAvg)}</td>
    </tr>`).join('');

  const totalRow = (label: string, vals: (number | null)[], cls = ''): string => {
    const total = vals.reduce<number>((a, v) => a + (v ?? 0), 0);
    return `
      <tr class="sc-total${cls}">
        <th scope="row" class="sc-name">${label}</th>
        <td></td>
        ${vals.slice(0, WEEKS).map((v, i) => `<td class="num sc-cell">${i + 1 > publishedWeeks ? '' : fmt(v)}</td>`).join('')}
        <td></td>
        <td class="num sc-avg">${total.toLocaleString('en-US')}</td>
      </tr>`;
  };

  return `
    <div class="sc-grid-wrap table-scroll" tabindex="0" role="region" aria-label="${escapeHtml(block.teamName)} scorecard">
      <table class="sc-grid">
        <caption class="visually-hidden">${escapeHtml(block.teamName)} — targets broken per shooter per week, of 50</caption>
        <thead>
          <tr>
            <th scope="col" class="sc-name">Shooter</th>
            <th scope="col" class="sc-start" title="Starting (going-in) average">Start</th>
            ${weekHeads}
            <th scope="col" class="sc-shot">Shot</th>
            <th scope="col" class="sc-avg">Avg</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          ${totalRow('Total targets', block.targets)}
          ${totalRow('Rank points', block.rankPoints)}
          ${totalRow('Bonus points', block.bonusPoints, ' sc-total--bonus')}
        </tfoot>
      </table>
    </div>`;
}

export function renderShooterCards(input: TeamPanelInput): string {
  const { block, captain, publishedWeeks } = input;
  const shown = Math.max(1, publishedWeeks);
  const cards = visibleShooters(block).map((s) => `
    <li class="sc-card">
      <div class="sc-card__head">
        <span class="sc-card__name">${escapeHtml(s.name)} ${badges(s, captain)}</span>
        <span class="sc-card__avg"><span class="num">${fmt(s.finalAvg)}</span><span>avg · ${fmt(s.weeksShot)} nights</span></span>
      </div>
      <div class="sc-card__weeks">
        ${s.scores.slice(0, shown).map((v, i) => `
          <span class="sc-card__wk"><span class="sc-card__wk-label">W${i + 1}</span>${heatCell(v, i + 1, publishedWeeks)}</span>`).join('')}
      </div>
    </li>`).join('');

  const weekRows = Array.from({ length: shown }, (_, i) => `
    <tr><th scope="row">W${i + 1}</th><td class="num">${fmt(block.targets[i])}</td><td class="num">${fmt(block.rankPoints[i])}</td><td class="num">${fmt(block.bonusPoints[i])}</td></tr>`).join('');

  return `
    <div class="sc-cards">
      <ul class="sc-card-list">${cards}</ul>
      <h3 class="sc-subhead">Team by week</h3>
      <table class="sc-week-table">
        <thead><tr><th scope="col">Week</th><th scope="col" class="num">Targets</th><th scope="col" class="num">Rank</th><th scope="col" class="num">Bonus</th></tr></thead>
        <tbody>${weekRows}</tbody>
      </table>
    </div>`;
}

export function renderHeatLegend(): string {
  return `
    <div class="sc-legend" aria-hidden="true">
      <span>Targets of 50</span>
      ${HEAT_LEGEND.map((l) => `<span class="sc-legend__item"><span class="heat heat--${l.bin} sc-legend__swatch"></span>${l.label}</span>`).join('')}
      <span class="sc-legend__item"><span class="heat heat--straight sc-legend__swatch"></span>Straight 50</span>
    </div>`;
}

export function renderTeamPanel(input: TeamPanelInput): string {
  const shooters = visibleShooters(input.block).filter((s) => !s.isDummy);
  const rookies = shooters.filter((s) => s.rookie).length;
  return `
    ${renderSummary(input, rookies, shooters.length)}
    <div class="card sc-sheet">
      <div class="sc-sheet__head">
        <h3 class="sc-subhead">Shooter scorecard</h3>
        ${renderHeatLegend()}
      </div>
      ${renderHeatGrid(input)}
      ${renderShooterCards(input)}
    </div>`;
}
