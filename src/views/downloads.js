/**
 * downloadsView — Score sheet PDF downloads
 *
 * Migrated from src/spa/downloads.html (main content only).
 * Fixed: date labels corrected from 2024 to 2025.
 */

/**
 * Returns the HTML string for the downloads view.
 * @returns {string}
 */
export function downloadsView() {
  return `
    <h2>2025 Score Sheets</h2>
    <table class="scoresheets-table">
      <tr><td><a href="/assets/score_sheets/2025w01.pdf" target="_blank">Week 01 (04/08/2025)</a></td></tr>
      <tr><td><a href="/assets/score_sheets/2025w02.pdf" target="_blank">Week 02 (04/15/2025)</a></td></tr>
      <tr><td><a href="/assets/score_sheets/2025w03.pdf" target="_blank">Week 03 (04/22/2025)</a></td></tr>
      <tr><td><a href="/assets/score_sheets/2025w04.pdf" target="_blank">Week 04 (04/29/2025)</a></td></tr>
      <tr><td><a href="/assets/score_sheets/2025w05.pdf" target="_blank">Week 05 (05/06/2025)</a></td></tr>
      <tr><td><a href="/assets/score_sheets/2025w06.pdf" target="_blank">Week 06 (05/13/2025)</a></td></tr>
      <tr><td><a href="/assets/score_sheets/2025w07.pdf" target="_blank">Week 07 (05/20/2025)</a></td></tr>
      <tr><td><a href="/assets/score_sheets/2025w08.pdf" target="_blank">Week 08 (05/27/2025)</a></td></tr>
      <tr><td><a href="/assets/score_sheets/2025w09.pdf" target="_blank">Week 09 (06/03/2025)</a></td></tr>
      <tr><td><a href="/assets/score_sheets/2025w10.pdf" target="_blank">Week 10 (06/10/2025)</a></td></tr>
      <tr><td><a href="/assets/score_sheets/2025w11.pdf" target="_blank">Week 11 (06/17/2025)</a></td></tr>
      <tr><td><a href="/assets/score_sheets/2025w12.pdf" target="_blank">Week 12 (06/24/2025)</a></td></tr>
      <tr><td><a href="/assets/score_sheets/2025w13.pdf" target="_blank">Week 13 (07/08/2025)</a></td></tr>
      <tr><td><a href="/assets/score_sheets/2025w14.pdf" target="_blank">Week 14 (07/15/2025)</a></td></tr>
      <tr><td><a href="/assets/score_sheets/2025w15.pdf" target="_blank">Week 15 (07/22/2025)</a></td></tr>
    </table>

    <h2>Yardage Table</h2>
    <a href="/assets/score_sheets/yardage-table.pdf" target="_blank">Download (PDF)</a>
  `;
}
