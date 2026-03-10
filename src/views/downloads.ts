/**
 * downloadsView — Dynamic scoresheet generator + static downloads
 */

export function downloadsView(): string {
  return `
    <div class="downloads-scoresheet-section">
      <h2 class="downloads-section-heading">Scoresheets</h2>
      <scoresheet-generator></scoresheet-generator>
    </div>
    <yardage-table></yardage-table>
  `;
}
