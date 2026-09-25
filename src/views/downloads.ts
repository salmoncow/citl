/**
 * downloadsView — Dynamic scoresheet generator + static downloads
 */

export function downloadsView(): string {
  return `
    <section class="page-hero bleed on-dark" aria-labelledby="downloads-title">
      <div class="page-hero__inner">
        <span class="eyebrow eyebrow--on-dark">Downloads</span>
        <h1 id="downloads-title">Score sheets &amp; yardage</h1>
        <p class="page-hero__lede">Print this week's team score sheets, or the yardage table for the range.</p>
      </div>
    </section>
    <div class="downloads-scoresheet-section card">
      <scoresheet-generator></scoresheet-generator>
    </div>
    <div class="card downloads-yardage">
      <yardage-table></yardage-table>
    </div>
  `;
}
