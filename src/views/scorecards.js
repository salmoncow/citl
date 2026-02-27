/**
 * scorecardsView — Collapsible per-team scorecards for all seasons (2019–2025).
 *
 * Data is imported from JSON files in src/data/scorecards/.
 * Renders seasons newest-first (2025 → 2019).
 */

import season2025 from '@/data/scorecards/2025.json';
import season2024 from '@/data/scorecards/2024.json';
import season2023 from '@/data/scorecards/2023.json';
import season2022 from '@/data/scorecards/2022.json';
import season2021 from '@/data/scorecards/2021.json';
import season2020 from '@/data/scorecards/2020.json';
import season2019 from '@/data/scorecards/2019.json';

const SEASONS = [season2025, season2024, season2023, season2022, season2021, season2020, season2019];

const WEEK_HEADERS = ['W0', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13', 'W14', 'W15'];

/**
 * Formats a score value for display.
 * @param {number|null} val
 * @returns {string}
 */
function fmt(val) {
  return val === null || val === undefined ? '-' : String(val);
}

/**
 * Renders a single shooter row.
 * @param {import('@/types/scorecard.js').Shooter} shooter
 * @returns {string}
 */
function renderShooterRow(shooter) {
  const rookieMark = shooter.rookie ? 'R' : '';
  const scoreCells = shooter.scores.map((s) => `<td>${fmt(s)}</td>`).join('');
  const weeks = shooter.weeksShot !== null && shooter.weeksShot !== undefined ? shooter.weeksShot : '-';
  return `<tr><td>${shooter.name}</td><td>${rookieMark}</td><td>${shooter.startingAvg}</td>${scoreCells}<td>${weeks}</td><td>${shooter.finalAvg}</td></tr>`;
}

/**
 * Renders the totals rows (TOTAL TARGETS, RANK POINTS, BONUS POINTS) for a team.
 * @param {import('@/types/scorecard.js').TeamTotals} totals
 * @returns {string}
 */
function renderTotalsRows(totals) {
  const targetCells = totals.targets.map((v) => `<td>${fmt(v)}</td>`).join('');
  const rpCells = totals.rankPoints.map((v) => `<td>${fmt(v)}</td>`).join('');
  const bpCells = totals.bonusPoints.map((v) => `<td>${fmt(v)}</td>`).join('');
  return `
        <tr><td>TOTAL TARGETS</td><td></td><td></td>${targetCells}<td></td><td></td></tr>
        <tr><td>RANK POINTS</td><td></td><td></td>${rpCells}<td></td><td></td></tr>
        <tr><td>BONUS POINTS</td><td></td><td></td>${bpCells}<td></td><td></td></tr>`;
}

/**
 * Renders a single team scorecard (button + collapsible table).
 * @param {import('@/types/scorecard.js').Team} team
 * @returns {string}
 */
function renderTeam(team) {
  const headerCells = WEEK_HEADERS.map((w) => `<th>${w}</th>`).join('');
  const shooterRows = team.shooters.map(renderShooterRow).join('\n        ');
  return `
    <button class="collapsible">${team.name}</button>
    <div class="scorecard">
      <table class="scorecard-tables">
        <tr><th></th><th></th>${headerCells}<th>Weeks Shot</th><th>Avg</th></tr>
        ${shooterRows}
        ${renderTotalsRows(team.totals)}
      </table>
    </div>`;
}

/**
 * Renders all teams for a single season.
 * @param {import('@/types/scorecard.js').SeasonData} season
 * @returns {string}
 */
function renderSeason(season) {
  const teamBlocks = season.teams.map(renderTeam).join('\n');
  return `
    <h2>${season.season} Scorecards</h2>
    ${teamBlocks}`;
}

/**
 * Returns the HTML string for the scorecards view (all seasons, newest-first).
 * @returns {string}
 */
export function scorecardsView() {
  return SEASONS.map(renderSeason).join('\n');
}
