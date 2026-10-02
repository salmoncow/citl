/**
 * accountView — /account route shell (spec 008 F3).
 *
 * Pure HTML-string factory. <account-page> is defined by a dynamic
 * import in main.ts (AC-9); until its chunk loads, the shell shows a
 * skeleton, which the element replaces when it upgrades.
 */

export function accountView(): string {
  return `
    <account-page>
      <span class="eyebrow">Account</span>
      <h1>Your account</h1>
      <div class="card" aria-busy="true" aria-label="Loading your account">
        <div class="skeleton-group">
          <span class="skeleton skeleton--lg"></span>
          <span class="skeleton skeleton--md"></span>
          <span class="skeleton skeleton--xl"></span>
        </div>
      </div>
    </account-page>`;
}
