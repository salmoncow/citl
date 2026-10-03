/**
 * main.ts — Application entry point
 *
 * Initializes navigation, router, and renders the correct view
 * based on the current URL hash. Maintains a single role observer
 * (modules/role.ts onRoleChange) for the page lifetime so the
 * navigation, admin-view DOM toggle, and route guard all react to
 * sign-in/out and server-driven role changes (via AuthModule's
 * roleChangedAt snapshot listener — see modules/auth.ts).
 */

// Stylesheet sections, split along main.css's former banner sections (F-22).
// Import order IS cascade order — it must reproduce the original file's
// top-to-bottom sequence exactly; Vite concatenates these into one CSS asset.
// Self-hosted fonts (spec 006) — keeps CSP font-src 'self'. Latin subset only.
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/nav.css';
import './styles/banner.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/tables.css';
import './styles/buttons.css';
import './styles/admin.css';
import './styles/about.css';
import './styles/toast.css';
import './styles/forms.css';
import './styles/admin-tables.css';
import './styles/admin-shell.css';
import './styles/scoresheet.css';
import './styles/home.css';
import './styles/scorecards.css';
import './styles/rules.css';
import './styles/print.css';
import './components/home-hero';
import './components/home-stats';
import './components/home-standings';
import './components/home-award-races';
import './components/home-announcements';
import './components/site-banner';
import './components/season-scorecards';
import './components/scoresheet-generator';
import './components/yardage-table';
import './components/season-calendar';
import './components/rules-toc';

import { NavigationModule } from './modules/navigation';
import { RouterModule } from './modules/router';
import { AuthModule } from './modules/auth';
import { AccountGate, isGatedPath } from './modules/account-gate';
import { setAccountContext } from './modules/account-context';
import { TERMS_VERSION } from './utils/legal';
import { onRoleChange } from './modules/role';
import type { Role } from './types/user';
import { initAppCheck } from './infrastructure/appcheck';
import { looksLikeEmailLink } from './utils/email-link';

import { homeView } from './views/home';
import { scorecardsView } from './views/scorecards';
import { rulesView } from './views/rules';
import { aboutView } from './views/about';
import { downloadsView } from './views/downloads';
import { adminView } from './views/admin';
import { accountView } from './views/account';
import { accountTeamView } from './views/account-team';
import { privacyView } from './views/privacy';

interface RouteDef {
  path: string;
  view: () => string;
  after?: () => void;
}

class App {
  private _navigation: NavigationModule | null = null;
  private _router: RouterModule | null = null;
  private _mainContent: HTMLElement | null = null;
  private _auth: AuthModule | null = null;
  private _gate: AccountGate | null = null;
  private _roleUnsubscribe: (() => void) | null = null;
  private _currentRole: Role | null = null;

  async init(): Promise<void> {
    initAppCheck();

    this._mainContent = document.getElementById('main-content');
    this._navigation = new NavigationModule();
    this._router = new RouterModule();
    this._auth = new AuthModule();
    this._gate = this._createAccountGate(this._auth);
    setAccountContext({ auth: this._auth, gate: this._gate });

    this._navigation.init({ onSignIn: () => void this._openSignIn() });

    // Spec 008: map the clean /privacy URL (used on provider consent
    // screens) onto the hash route, and capture an email sign-in link
    // before the router sees the URL.
    const emailLinkUrl = this._captureBootUrl();

    // Wait for the initial role read (sign-in restore from local
    // persistence, or null) before registering routes so the /admin
    // guard sees a valid value on first deep-link.
    await this._initRoleObserver();

    // Email-link completion starts before the router (AC-5); it is not
    // awaited, so the first view renders while sign-in finishes.
    if (emailLinkUrl) void this._completeEmailLink(emailLinkUrl);

    this._setupRoutes();
    this._router.init();
  }

  // ─── Account gate (spec 008 AC-10, AC-12, AC-15) ────────────────────────────

  private _createAccountGate(authModule: AuthModule): AccountGate {
    const gate = new AccountGate({
      onUserDoc: (cb) => authModule.onUserDoc(cb),
      loadProfile: async (uid) => {
        const { getAccountService } = await import('./services/account-service');
        const result = await getAccountService().loadProfile(uid);
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
      termsVersion: TERMS_VERSION,
    });
    // When the decision turns blocking (sign-in, deactivation, terms
    // bump), move the user to /account unless they're somewhere allowed.
    gate.onChange((decision) => {
      const path = this._router?.getCurrentRoute() ?? '/';
      if (isGatedPath(decision, path)) window.location.hash = '#/account';
    });
    return gate;
  }

  // ─── Boot URL handling (spec 008 AC-5, DD-4) ────────────────────────────────

  /**
   * Returns the email-link URL if this page load is one, after rewriting
   * the address bar to /#/account so the one-time code never stays in
   * history. Also maps pathname /privacy to #/privacy.
   */
  private _captureBootUrl(): string | null {
    const href = window.location.href;
    if (looksLikeEmailLink(href)) {
      window.history.replaceState(null, '', '/#/account');
      return href;
    }
    if (window.location.pathname === '/privacy') {
      window.history.replaceState(null, '', '/#/privacy');
    }
    return null;
  }

  private async _completeEmailLink(url: string): Promise<void> {
    const [{ completeEmailLink }, { showToast }] = await Promise.all([
      import('./modules/auth-providers'),
      import('./modules/ui'),
    ]);
    const outcome = await completeEmailLink(url);
    switch (outcome.status) {
      case 'signed-in':
        showToast('success', 'Signed in.');
        break;
      case 'linked':
        showToast('success', 'Email sign-in is now connected to your account.');
        break;
      case 'reauthenticated':
        showToast('success', 'Confirmed. You can continue.');
        break;
      case 'needs-email': {
        const { openSignInDialog } = await import('./components/sign-in-dialog');
        await openSignInDialog({ mode: 'confirm-email', linkUrl: url });
        break;
      }
      case 'error':
        showToast('error', outcome.message);
        break;
      default:
        break;
    }
  }

  // ─── Sign-in dialog (lazy, AC-9) ────────────────────────────────────────────

  private async _openSignIn(): Promise<void> {
    const { openSignInDialog } = await import('./components/sign-in-dialog');
    await openSignInDialog();
  }

  // ─── Role observation ───────────────────────────────────────────────────────

  private _initRoleObserver(): Promise<void> {
    return new Promise<void>((resolve) => {
      let resolved = false;
      this._roleUnsubscribe = onRoleChange((role) => {
        this._currentRole = role;
        this._navigation!.updateAuthState(this._auth!.currentUser, role);
        this._applyAdminViewState();
        if (!resolved) {
          resolved = true;
          resolve();
        }
      });
    });
  }

  private _isElevated(): boolean {
    return this._currentRole === 'owner' || this._currentRole === 'admin';
  }

  private _applyAdminViewState(): void {
    const elevated = this._isElevated();
    const signedIn = !!this._auth!.currentUser;

    document.getElementById('admin-login')?.toggleAttribute('hidden', signedIn);
    document.getElementById('admin-unauthorized')?.toggleAttribute('hidden', !signedIn || elevated);
    document.getElementById('admin-panel-container')?.toggleAttribute('hidden', !signedIn || !elevated);

    const userDisplay = document.getElementById('admin-user-display');
    if (userDisplay) {
      userDisplay.textContent = this._auth!.currentUser?.email ?? '';
    }

    // Lazy-mount <admin-panel> only when the viewer is elevated. Web
    // Components run connectedCallback the moment they exist in the
    // DOM (even inside a hidden parent), and admin-panel fetches data
    // eagerly — keeping it out of the DOM avoids spurious rule denials
    // in the console for non-elevated viewers. The Users tab inside
    // admin-panel hosts <admin-users-panel> as a child element, so it
    // mounts/unmounts together with the shell.
    const mount = document.getElementById('admin-panel-mount');
    if (mount) {
      const isMounted = mount.querySelector('admin-panel') !== null;
      if (elevated && !isMounted) {
        // Spec 010 DD-6: the admin panel is a lazy chunk; the element
        // upgrades when its module defines it.
        void import('./components/admin-panel');
        mount.innerHTML = '<admin-panel></admin-panel>';
      } else if (!elevated && isMounted) {
        // Clearing innerHTML disconnects the components, firing their
        // disconnectedCallback so they tear down listeners cleanly.
        mount.innerHTML = '';
      }
    }
  }

  // ─── Routing ────────────────────────────────────────────────────────────────
  // Data-driven route table (spec 003 AC-9): every route shares one render
  // path; `after` covers per-route extra wiring and runs before scrollTo,
  // matching the old /admin handler's ordering.

  private _setupRoutes(): void {
    const routes: RouteDef[] = [
      { path: '/', view: homeView },
      { path: '/scorecards', view: scorecardsView },
      { path: '/rules', view: rulesView },
      { path: '/about', view: aboutView },
      { path: '/downloads', view: downloadsView },
      { path: '/privacy', view: privacyView },
      {
        path: '/account',
        view: accountView,
        after: () => { void import('./components/account-page'); },
      },
      {
        path: '/account/team',
        view: accountTeamView,
        after: () => { void import('./components/team-proposal-page'); },
      },
      {
        path: '/admin',
        view: adminView,
        after: () => {
          this._wireAdminAuthButtons();
          this._applyAdminViewState();
        },
      },
    ];
    for (const route of routes) {
      this._router!.register(route.path, () => this._showRoute(route));
    }

    this._router!.onBeforeNavigate((path) => {
      // Account gate: a signed-in user who must complete their profile,
      // accept updated terms, or reactivate is sent to /account (UX only;
      // rules and callables enforce). The redirect is deferred so it
      // lands after the router restores the current route.
      if (isGatedPath(this._gate!.decision, path)) {
        setTimeout(() => { window.location.hash = '#/account'; }, 0);
        return false;
      }

      // Route guard: signed-out users are allowed through /admin
      // (they'll see the sign-in gate via _applyAdminViewState). Only bounce
      // signed-in users whose role is 'user' — they can't act on
      // /admin and the redirect avoids a dead-end "unauthorized" view.
      // Server-side rules + the callable still enforce; this is UX.
      if (path === '/admin') {
        const signedIn = !!this._auth!.currentUser;
        if (signedIn && !this._isElevated()) {
          window.location.hash = '#/';
          return false;
        }
      }
      return true;
    });
  }

  // ─── View renderer ──────────────────────────────────────────────────────────

  private _showRoute(route: RouteDef): void {
    // Exposed for route-scoped layout (e.g. the full-bleed home hero).
    if (this._mainContent) this._mainContent.dataset['route'] = route.path;
    this._renderView(route.view());
    this._navigation!.setActiveLink(route.path);
    this._navigation!.closeDropdown();
    this._navigation!.closeBurgerNav();
    route.after?.();
    window.scrollTo(0, 0);
  }

  // ─── Admin auth buttons (wired each time the view is rendered) ──────────────

  private _wireAdminAuthButtons(): void {
    document.getElementById('admin-sign-in')
      ?.addEventListener('click', () => void this._openSignIn());
    document.getElementById('admin-sign-out')
      ?.addEventListener('click', () => void this._auth!.signOut());
    document.getElementById('admin-sign-out-unauth')
      ?.addEventListener('click', () => void this._auth!.signOut());
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private _renderView(html: string): void {
    if (this._mainContent) {
      this._mainContent.innerHTML = html;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  void app.init();
});
