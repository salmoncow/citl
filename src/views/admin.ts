/**
 * adminView — Admin portal login gate + panel container
 *
 * Pure HTML-string factory. No business logic.
 * Auth state toggling (show/hide sections) is handled in main.ts _initAdminAuth().
 * Score entry is handled by the <admin-panel> Custom Element.
 *
 * Spec 006 DD-12: while #admin-panel-container is visible the public header
 * and footer are hidden (CSS :has) and <admin-panel> lays itself out as a
 * sidebar app shell; the auth chrome below keeps its IDs (main.ts wires them)
 * and is placed at the foot of the sidebar by CSS grid.
 */

export function adminView(): string {
  return `
    <section id="admin-login" class="admin-gate card">
      <span class="eyebrow">Admin portal</span>
      <h1>Sign in</h1>
      <p>Sign in with your Google account to access the admin panel.</p>
      <button id="admin-sign-in" class="btn-primary btn-lg">Sign in with Google</button>
    </section>

    <section id="admin-unauthorized" class="admin-gate card" hidden>
      <span class="eyebrow">Admin portal</span>
      <h1>No admin access</h1>
      <p>You are signed in but do not have admin access to this portal.</p>
      <p>Contact the league administrator to request access.</p>
      <button id="admin-sign-out-unauth" class="btn-secondary">Sign out</button>
    </section>

    <div id="admin-panel-container" class="admin-shell" hidden>
      <div class="admin-header on-dark">
        <span class="admin-header__label">Signed in as</span>
        <span id="admin-user-display"></span>
        <button id="admin-sign-out" class="btn-outline-dark">Sign out</button>
      </div>
      <!--
        Admin Custom Elements are mounted lazily by main.ts when the
        signed-in user's role becomes owner|admin. Keeping them out of
        the DOM until then avoids their connectedCallback firing with
        a non-elevated viewer, which would trigger Firestore rule
        denials for their initial data fetches.
      -->
      <div id="admin-panel-mount"></div>
    </div>
  `;
}
