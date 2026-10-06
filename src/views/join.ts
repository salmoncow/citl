/**
 * joinView — #/join route shell (spec 012).
 *
 * Pure HTML-string factory. <join-page> is defined by a dynamic import in
 * main.ts; until its chunk loads, the shell shows a skeleton.
 */

export function joinView(): string {
  return `
    <join-page>
      <span class="eyebrow">Join the league</span>
      <h1>Join the league</h1>
      <div class="card" aria-busy="true" aria-label="Loading">
        <div class="skeleton-group">
          <span class="skeleton skeleton--lg"></span>
          <span class="skeleton skeleton--md"></span>
          <span class="skeleton skeleton--xl"></span>
        </div>
      </div>
    </join-page>`;
}
