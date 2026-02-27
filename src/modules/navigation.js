/**
 * NavigationModule
 *
 * Manages all navigation interactions:
 * - Burger menu toggle (mobile responsive nav)
 * - Resources dropdown open/close (click + outside-click + Escape)
 * - Scroll progress bar
 * - Active link highlighting per current route
 *
 * Replaces the old global functions: burgerNav(), dropButton(),
 * progressBar(), window.onscroll, window.onclick from scripts.js.
 */

export class NavigationModule {
  constructor() {
    this._topnav = null;
    this._dropdown = null;
    this._progressBar = null;
    this._burgerBtn = null;
    this._dropBtn = null;
    this._dropdownOpen = false;

    // Bound handler references for cleanup
    this._boundScrollHandler = this._updateProgressBar.bind(this);
    this._boundClickOutsideHandler = this._handleClickOutside.bind(this);
    this._boundKeydownHandler = this._handleKeydown.bind(this);
  }

  /**
   * Cache DOM elements and attach all event listeners.
   * Must be called after DOMContentLoaded.
   */
  init() {
    this._topnav = document.getElementById('topnav');
    this._dropdown = document.getElementById('dropdown');
    this._progressBar = document.getElementById('myBar');
    this._burgerBtn = document.getElementById('burger-btn');
    this._dropBtn = document.getElementById('dropbtn');

    if (this._burgerBtn) {
      this._burgerBtn.addEventListener('click', () => this._toggleBurgerNav());
    }

    if (this._dropBtn) {
      this._dropBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleDropdown();
      });
    }

    window.addEventListener('scroll', this._boundScrollHandler);
    document.addEventListener('click', this._boundClickOutsideHandler);
    document.addEventListener('keydown', this._boundKeydownHandler);
  }

  /**
   * Update the active nav link based on the current route path.
   * @param {string} path - e.g. '/' or '/scorecards'
   */
  setActiveLink(path) {
    if (!this._topnav) return;
    const links = this._topnav.querySelectorAll('a[data-route]');
    links.forEach((link) => {
      const route = link.getAttribute('data-route');
      if (route === path) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  /**
   * Close the Resources dropdown. Called by the router after navigation.
   */
  closeDropdown() {
    if (this._dropdown) {
      this._dropdown.classList.remove('dropdown-show');
      this._dropdownOpen = false;
      if (this._dropBtn) this._dropBtn.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Stub for future admin auth state integration (Phase 5).
   * @param {object|null} _user
   */
  updateAuthState(_user) {
    // no-op in Phase 1 — wired in Phase 5 for admin sign-in
  }

  /**
   * Remove all event listeners (called on app teardown).
   */
  destroy() {
    window.removeEventListener('scroll', this._boundScrollHandler);
    document.removeEventListener('click', this._boundClickOutsideHandler);
    document.removeEventListener('keydown', this._boundKeydownHandler);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  _toggleBurgerNav() {
    if (!this._topnav) return;
    this._topnav.classList.toggle('responsive');
    // Close dropdown when burger is toggled
    this.closeDropdown();
  }

  _toggleDropdown() {
    if (!this._dropdown) return;
    this._dropdownOpen = !this._dropdownOpen;
    if (this._dropdownOpen) {
      this._dropdown.classList.add('dropdown-show');
      if (this._dropBtn) this._dropBtn.setAttribute('aria-expanded', 'true');
    } else {
      this.closeDropdown();
    }
  }

  _handleClickOutside(event) {
    if (!this._dropdownOpen) return;
    const dropContainer = this._dropBtn ? this._dropBtn.closest('.dropdown') : null;
    if (dropContainer && !dropContainer.contains(event.target)) {
      this.closeDropdown();
    }
  }

  _handleKeydown(event) {
    if (event.key === 'Escape' && this._dropdownOpen) {
      this.closeDropdown();
    }
  }

  _updateProgressBar() {
    if (!this._progressBar) return;
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrollPercent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    this._progressBar.style.width = `${scrollPercent}%`;
  }
}
