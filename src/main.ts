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
import './styles/tokens.css';
import './styles/base.css';
import './styles/nav.css';
import './styles/banner.css';
import './styles/layout.css';
import './styles/tables.css';
import './styles/buttons.css';
import './styles/admin.css';
import './styles/about.css';
import './styles/toast.css';
import './styles/forms.css';
import './styles/admin-tables.css';
import './styles/scoresheet.css';
import './styles/print.css';
import './components/home-standings';
import './components/home-announcements';
import './components/site-banner';
import './components/season-scorecards';
import './components/admin-panel';
import './components/scoresheet-generator';
import './components/yardage-table';
import './components/season-calendar';

import { NavigationModule } from './modules/navigation';
import { RouterModule } from './modules/router';
import { AuthModule } from './modules/auth';
import { onRoleChange } from './modules/role';
import type { Role } from './types/user';
import { initAppCheck } from './infrastructure/appcheck';

import { homeView } from './views/home';
import { scorecardsView } from './views/scorecards';
import { rulesView } from './views/rules';
import { aboutView } from './views/about';
import { downloadsView } from './views/downloads';
import { adminView } from './views/admin';

class App {
  private _navigation: NavigationModule | null = null;
  private _router: RouterModule | null = null;
  private _mainContent: HTMLElement | null = null;
  private _auth: AuthModule | null = null;
  private _roleUnsubscribe: (() => void) | null = null;
  private _currentRole: Role | null = null;

  async init(): Promise<void> {
    initAppCheck();

    this._mainContent = document.getElementById('main-content');
    this._navigation = new NavigationModule();
    this._router = new RouterModule();
    this._auth = new AuthModule();

    this._navigation.init();

    // Wait for the initial role read (sign-in restore from local
    // persistence, or null) before registering routes so the /admin
    // guard sees a valid value on first deep-link.
    await this._initRoleObserver();

    this._setupRoutes();
    this._router.init();
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
        mount.innerHTML = '<admin-panel></admin-panel>';
      } else if (!elevated && isMounted) {
        // Clearing innerHTML disconnects the components, firing their
        // disconnectedCallback so they tear down listeners cleanly.
        mount.innerHTML = '';
      }
    }
  }

  // ─── Routing ────────────────────────────────────────────────────────────────

  private _setupRoutes(): void {
    this._router!.register('/', () => this._showHome());
    this._router!.register('/scorecards', () => this._showScorecards());
    this._router!.register('/rules', () => this._showRules());
    this._router!.register('/about', () => this._showAbout());
    this._router!.register('/downloads', () => this._showDownloads());
    this._router!.register('/admin', () => this._showAdmin());

    this._router!.onBeforeNavigate((path) => {
      // Route guard: /admin is the SOLE entry point for sign-in, so
      // signed-out users must be allowed through (they'll see the
      // sign-in view via _applyAdminViewState DOM toggle). Only bounce
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

  // ─── View renderers ─────────────────────────────────────────────────────────

  private _showHome(): void {
    this._renderView(homeView());
    this._navigation!.setActiveLink('/');
    this._navigation!.closeDropdown();
    this._navigation!.closeBurgerNav();
    window.scrollTo(0, 0);
  }

  private _showScorecards(): void {
    this._renderView(scorecardsView());
    this._navigation!.setActiveLink('/scorecards');
    this._navigation!.closeDropdown();
    this._navigation!.closeBurgerNav();
    window.scrollTo(0, 0);
  }

  private _showRules(): void {
    this._renderView(rulesView());
    this._navigation!.setActiveLink('/rules');
    this._navigation!.closeDropdown();
    this._navigation!.closeBurgerNav();
    window.scrollTo(0, 0);
  }

  private _showAbout(): void {
    this._renderView(aboutView());
    this._navigation!.setActiveLink('/about');
    this._navigation!.closeDropdown();
    this._navigation!.closeBurgerNav();
    window.scrollTo(0, 0);
  }

  private _showDownloads(): void {
    this._renderView(downloadsView());
    this._navigation!.setActiveLink('/downloads');
    this._navigation!.closeDropdown();
    this._navigation!.closeBurgerNav();
    window.scrollTo(0, 0);
  }

  private _showAdmin(): void {
    this._renderView(adminView());
    this._navigation!.setActiveLink('/admin');
    this._navigation!.closeDropdown();
    this._navigation!.closeBurgerNav();
    this._wireAdminAuthButtons();
    this._applyAdminViewState();
    window.scrollTo(0, 0);
  }

  // ─── Admin auth buttons (wired each time the view is rendered) ──────────────

  private _wireAdminAuthButtons(): void {
    document.getElementById('admin-sign-in')
      ?.addEventListener('click', () => void this._auth!.signIn());
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
