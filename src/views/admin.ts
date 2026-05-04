/**
 * adminView — Admin portal login gate + panel container
 *
 * Pure HTML-string factory. No business logic.
 * Auth state toggling (show/hide sections) is handled in main.ts _initAdminAuth().
 * Score entry is handled by the <admin-panel> Custom Element.
 */

export function adminView(): string {
  return `
    <h1>Admin Portal</h1>

    <div id="admin-login">
      <p>Sign in with your Google account to access the admin panel.</p>
      <button id="admin-sign-in" class="btn-primary">Sign in with Google</button>
    </div>

    <div id="admin-unauthorized" hidden>
      <p>You are signed in but do not have admin access to this portal.</p>
      <p>Contact the league administrator to request access.</p>
      <button id="admin-sign-out-unauth" class="btn-secondary">Sign out</button>
    </div>

    <div id="admin-panel-container" hidden>
      <div class="admin-header">
        <span id="admin-user-display"></span>
        <button id="admin-sign-out" class="btn-secondary">Sign out</button>
      </div>
      <admin-panel></admin-panel>
      <admin-users-panel></admin-users-panel>
    </div>
  `;
}
