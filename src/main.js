/**
 * main.js — Application entry point
 *
 * Initializes navigation, router, and renders the correct view
 * based on the current URL hash.
 *
 * Phase 1: Static views, no Firebase.
 * Phase 2+: Firebase config wired in, auth and Firestore added.
 * Phase 5: Admin portal with Google auth (localStorage backend).
 */

import './styles/main.css';
import './components/standings-table.js';
import './components/admin-panel.js';

import { NavigationModule } from './modules/navigation.js';
import { RouterModule } from './modules/router.js';
import { AuthModule } from './modules/auth.js';

import { homeView } from './views/home.js';
import { scorecardsView } from './views/scorecards.js';
import { rulesView } from './views/rules.js';
import { aboutView } from './views/about.js';
import { downloadsView } from './views/downloads.js';
import { adminView } from './views/admin.js';

class App {
  constructor() {
    this._navigation = null;
    this._router = null;
    this._mainContent = null;
    this._auth = null;
    this._adminAuthUnsubscribe = null;
  }

  init() {
    this._mainContent = document.getElementById('main-content');
    this._navigation = new NavigationModule();
    this._router = new RouterModule();
    this._auth = new AuthModule();

    this._navigation.init();
    this._setupRoutes();
    this._router.init();
  }

  _setupRoutes() {
    this._router.register('/', () => this._showHome());
    this._router.register('/scorecards', () => this._showScorecards());
    this._router.register('/rules', () => this._showRules());
    this._router.register('/about', () => this._showAbout());
    this._router.register('/downloads', () => this._showDownloads());
    this._router.register('/admin', () => this._showAdmin());

    // Clean up admin auth subscription when leaving the admin route
    this._router.onBeforeNavigate((path) => {
      if (this._router.getCurrentRoute() === '/admin' && path !== '/admin') {
        this._cleanupAdmin();
      }
      // Always allow navigation
    });
  }

  // ─── View renderers ─────────────────────────────────────────────────────────

  _showHome() {
    this._renderView(homeView());
    this._navigation.setActiveLink('/');
    this._navigation.closeDropdown();
    window.scrollTo(0, 0);
  }

  _showScorecards() {
    this._renderView(scorecardsView());
    this._navigation.setActiveLink('/scorecards');
    this._navigation.closeDropdown();
    this._initCollapsibles();
    window.scrollTo(0, 0);
  }

  _showRules() {
    this._renderView(rulesView());
    this._navigation.setActiveLink('/rules');
    this._navigation.closeDropdown();
    window.scrollTo(0, 0);
  }

  _showAbout() {
    this._renderView(aboutView());
    this._navigation.setActiveLink('/about');
    this._navigation.closeDropdown();
    window.scrollTo(0, 0);
  }

  _showDownloads() {
    this._renderView(downloadsView());
    this._navigation.setActiveLink('/downloads');
    this._navigation.closeDropdown();
    window.scrollTo(0, 0);
  }

  _showAdmin() {
    this._renderView(adminView());
    this._navigation.setActiveLink('/admin');
    this._navigation.closeDropdown();
    this._initAdminAuth();
    window.scrollTo(0, 0);
  }

  // ─── Admin auth ──────────────────────────────────────────────────────────────

  _initAdminAuth() {
    const applyAuthState = (user) => {
      this._navigation.updateAuthState(user);
      document.getElementById('admin-login')?.toggleAttribute('hidden', !!user);
      document.getElementById('admin-panel-container')?.toggleAttribute('hidden', !user);

      const userDisplay = document.getElementById('admin-user-display');
      if (userDisplay) {
        userDisplay.textContent = user ? user.email : '';
      }
    };

    // Apply current state immediately (no flicker on re-navigation)
    applyAuthState(this._auth.currentUser);

    // Subscribe to future auth state changes
    this._adminAuthUnsubscribe = this._auth.onAuthStateChanged(applyAuthState);

    document.getElementById('admin-sign-in')
      ?.addEventListener('click', () => this._auth.signIn());
    document.getElementById('admin-sign-out')
      ?.addEventListener('click', () => this._auth.signOut());
  }

  _cleanupAdmin() {
    if (this._adminAuthUnsubscribe) {
      this._adminAuthUnsubscribe();
      this._adminAuthUnsubscribe = null;
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Render HTML into the main content area.
   * @param {string} html
   *
   * Constitutional note (§IV.2): innerHTML is flagged as a forbidden pattern when
   * used with user-supplied content. All view functions return static, developer-authored
   * HTML strings — no user input ever flows into this call. This is accepted transitional
   * debt: in Phase 4, views will be replaced by Web Components that build DOM directly,
   * eliminating this pattern entirely. See constitution §II.4 and ADR-004.
   */
  _renderView(html) {
    if (this._mainContent) {
      this._mainContent.innerHTML = html;
    }
  }

  /**
   * Initialize collapsible scorecard accordion.
   * Must be called after scorecardsView() HTML is in the DOM.
   * Replaces the old scripts.js collapsible initialization.
   */
  _initCollapsibles() {
    const collapsibles = document.querySelectorAll('.collapsible');
    collapsibles.forEach((btn) => {
      btn.addEventListener('click', function () {
        this.classList.toggle('active');
        const panel = this.nextElementSibling;
        if (panel && panel.classList.contains('scorecard')) {
          if (panel.style.maxHeight) {
            panel.style.maxHeight = null;
          } else {
            panel.style.maxHeight = `${panel.scrollHeight}px`;
          }
        }
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
