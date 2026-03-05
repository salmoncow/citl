/**
 * downloadsView — Dynamic scoresheet generator + static downloads
 */

export function downloadsView(): string {
  return `
    <h2>Score Sheets</h2>
    <scoresheet-generator></scoresheet-generator>

    <div class="downloads-static">
      <h2>Yardage Table</h2>
      <a href="/assets/score_sheets/yardage-table.pdf" target="_blank">Download (PDF)</a>
    </div>
  `;
}
