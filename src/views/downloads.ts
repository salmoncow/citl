/**
 * downloadsView — Dynamic scoresheet generator + static downloads
 */

export function downloadsView(): string {
  return `
    <div class="downloads-scoresheet-section">
      <scoresheet-generator></scoresheet-generator>
    </div>
    <yardage-table></yardage-table>
  `;
}
