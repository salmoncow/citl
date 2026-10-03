/**
 * accountTeamView — /account/team route shell (spec 009 AC-10).
 *
 * Pure HTML-string factory. <team-proposal-page> is defined by a dynamic
 * import in main.ts; until its chunk loads, the shell shows a skeleton.
 */

export function accountTeamView(): string {
  return `
    <team-proposal-page>
      <span class="eyebrow">Team proposal</span>
      <h1>Team proposal</h1>
      <div class="card" aria-busy="true" aria-label="Loading your team proposal">
        <div class="skeleton-group">
          <span class="skeleton skeleton--lg"></span>
          <span class="skeleton skeleton--md"></span>
          <span class="skeleton skeleton--xl"></span>
        </div>
      </div>
    </team-proposal-page>`;
}
