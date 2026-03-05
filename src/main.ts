/**
 * main.ts — Application entry point
 *
 * Initializes navigation, router, and renders the correct view
 * based on the current URL hash.
 */

import './styles/main.css';
import './components/home-standings';
import './components/season-scorecards';
import './components/admin-panel';
import './components/scoresheet-generator';
import './components/season-calendar';

import { NavigationModule } from './modules/navigation';
import { RouterModule } from './modules/router';
import { AuthModule } from './modules/auth';

import { homeView } from './views/home';
import { scorecardsView } from './views/scorecards';
import { rulesView } from './views/rules';
import { aboutView } from './views/about';
import { downloadsView } from './views/downloads';
import { adminView } from './views/admin';

import type { User } from 'firebase/auth';

class App {
  private _navigation: NavigationModule | null = null;
  private _router: RouterModule | null = null;
  private _mainContent: HTMLElement | null = null;
  private _auth: AuthModule | null = null;
  private _adminAuthUnsubscribe: (() => void) | null = null;

  init(): void {
    this._mainContent = document.getElementById('main-content');
    this._navigation = new NavigationModule();
    this._router = new RouterModule();
    this._auth = new AuthModule();

    this._navigation.init();
    this._setupRoutes();
    this._router.init();
  }

  private _setupRoutes(): void {
    this._router!.register('/', () => this._showHome());
    this._router!.register('/scorecards', () => this._showScorecards());
    this._router!.register('/rules', () => this._showRules());
    this._router!.register('/about', () => this._showAbout());
    this._router!.register('/downloads', () => this._showDownloads());
    this._router!.register('/admin', () => this._showAdmin());

    this._router!.onBeforeNavigate((path) => {
      if (this._router!.getCurrentRoute() === '/admin' && path !== '/admin') {
        this._cleanupAdmin();
      }
    });
  }

  // ─── View renderers ─────────────────────────────────────────────────────────

  private _showHome(): void {
    this._renderView(homeView());
    this._navigation!.setActiveLink('/');
    this._navigation!.closeDropdown();
    window.scrollTo(0, 0);
  }

  private _showScorecards(): void {
    this._renderView(scorecardsView());
    this._navigation!.setActiveLink('/scorecards');
    this._navigation!.closeDropdown();
    window.scrollTo(0, 0);
  }

  private _showRules(): void {
    this._renderView(rulesView());
    this._navigation!.setActiveLink('/rules');
    this._navigation!.closeDropdown();
    window.scrollTo(0, 0);
  }

  private _showAbout(): void {
    this._renderView(aboutView());
    this._navigation!.setActiveLink('/about');
    this._navigation!.closeDropdown();
    window.scrollTo(0, 0);
  }

  private _showDownloads(): void {
    this._renderView(downloadsView());
    this._navigation!.setActiveLink('/downloads');
    this._navigation!.closeDropdown();
    window.scrollTo(0, 0);
  }

  private _showAdmin(): void {
    this._renderView(adminView());
    this._navigation!.setActiveLink('/admin');
    this._navigation!.closeDropdown();
    this._initAdminAuth();
    window.scrollTo(0, 0);
  }

  // ─── Admin auth ──────────────────────────────────────────────────────────────

  private _initAdminAuth(): void {
    const applyAuthState = async (user: User | null): Promise<void> => {
      this._navigation!.updateAuthState(user);

      let isAdmin = false;
      if (user) {
        isAdmin = await this._auth!.isAdmin();
      }

      document.getElementById('admin-login')?.toggleAttribute('hidden', !!user);
      document.getElementById('admin-unauthorized')?.toggleAttribute('hidden', !user || isAdmin);
      document.getElementById('admin-panel-container')?.toggleAttribute('hidden', !user || !isAdmin);

      const userDisplay = document.getElementById('admin-user-display');
      if (userDisplay) {
        userDisplay.textContent = user ? (user.email ?? '') : '';
      }
    };

    void applyAuthState(this._auth!.currentUser);

    this._adminAuthUnsubscribe = this._auth!.onAuthStateChanged((user) => void applyAuthState(user));

    document.getElementById('admin-sign-in')
      ?.addEventListener('click', () => void this._auth!.signIn());
    document.getElementById('admin-sign-out')
      ?.addEventListener('click', () => void this._auth!.signOut());
    document.getElementById('admin-sign-out-unauth')
      ?.addEventListener('click', () => void this._auth!.signOut());
  }

  private _cleanupAdmin(): void {
    if (this._adminAuthUnsubscribe) {
      this._adminAuthUnsubscribe();
      this._adminAuthUnsubscribe = null;
    }
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
  app.init();
});
