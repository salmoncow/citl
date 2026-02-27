/**
 * RouterModule — hash-based SPA router
 *
 * Routes are registered as path strings (e.g. '/', '/scorecards').
 * Navigation uses window.location.hash (e.g. '#/', '#/scorecards').
 *
 * Modeled after salmoncow src/modules/router.js.
 */

export class RouterModule {
  constructor() {
    /** @type {Map<string, function>} */
    this._routes = new Map();

    /** @type {function|null} */
    this._beforeNavigateCallback = null;

    /** @type {string} */
    this._currentRoute = '/';
  }

  /**
   * Register a route handler.
   * @param {string} path - e.g. '/' or '/scorecards'
   * @param {function} handler - called when route is active
   */
  register(path, handler) {
    this._routes.set(this._normalizePath(path), handler);
  }

  /**
   * Navigate to a route programmatically.
   * @param {string} path - e.g. '/' or '/scorecards'
   */
  navigate(path) {
    const normalized = this._normalizePath(path);
    if (this._beforeNavigateCallback) {
      const allowed = this._beforeNavigateCallback(normalized);
      if (allowed === false) return;
    }
    window.location.hash = normalized === '/' ? '#/' : `#${normalized}`;
  }

  /**
   * Register a guard that runs before every navigation.
   * Return false from the callback to cancel the navigation.
   * @param {function(string): boolean|void} callback
   */
  onBeforeNavigate(callback) {
    this._beforeNavigateCallback = callback;
  }

  /**
   * Initialize the router: handle the current hash and listen for changes.
   */
  init() {
    window.addEventListener('hashchange', () => this._handleRouteChange());
    this._handleRouteChange();
  }

  /**
   * Returns the current active route path (e.g. '/scorecards').
   * @returns {string}
   */
  getCurrentRoute() {
    return this._currentRoute;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  _handleRouteChange() {
    const path = this._getPathFromHash();

    if (this._beforeNavigateCallback) {
      const allowed = this._beforeNavigateCallback(path);
      if (allowed === false) {
        // Restore previous hash without triggering another hashchange
        window.history.replaceState(null, '', `#${this._currentRoute}`);
        return;
      }
    }

    this._currentRoute = path;

    const handler = this._routes.get(path);
    if (handler) {
      handler();
    } else {
      // Unknown route — fall back to home
      const homeHandler = this._routes.get('/');
      if (homeHandler) homeHandler();
    }
  }

  _getPathFromHash() {
    const hash = window.location.hash;
    if (!hash || hash === '#' || hash === '#/') return '/';
    // Strip leading '#'
    const path = hash.startsWith('#') ? hash.slice(1) : hash;
    return this._normalizePath(path);
  }

  _normalizePath(path) {
    if (!path || path === '/') return '/';
    // Ensure leading slash, no trailing slash
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return normalized.endsWith('/') && normalized.length > 1
      ? normalized.slice(0, -1)
      : normalized;
  }
}
