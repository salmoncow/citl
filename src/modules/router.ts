/**
 * RouterModule — hash-based SPA router
 *
 * Routes are registered as path strings (e.g. '/', '/scorecards').
 * Navigation uses window.location.hash (e.g. '#/', '#/scorecards').
 */

export class RouterModule {
  private readonly _routes = new Map<string, () => void>();
  private _beforeNavigateCallback: ((path: string) => boolean | void) | null = null;
  private _currentRoute = '/';

  register(path: string, handler: () => void): void {
    this._routes.set(this._normalizePath(path), handler);
  }

  navigate(path: string): void {
    const normalized = this._normalizePath(path);
    if (this._beforeNavigateCallback) {
      const allowed = this._beforeNavigateCallback(normalized);
      if (allowed === false) return;
    }
    window.location.hash = normalized === '/' ? '#/' : `#${normalized}`;
  }

  onBeforeNavigate(callback: (path: string) => boolean | void): void {
    this._beforeNavigateCallback = callback;
  }

  init(): void {
    window.addEventListener('hashchange', () => this._handleRouteChange());
    this._handleRouteChange();
  }

  getCurrentRoute(): string {
    return this._currentRoute;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _handleRouteChange(): void {
    const path = this._getPathFromHash();

    if (this._beforeNavigateCallback) {
      const allowed = this._beforeNavigateCallback(path);
      if (allowed === false) {
        window.history.replaceState(null, '', `#${this._currentRoute}`);
        return;
      }
    }

    this._currentRoute = path;

    const handler = this._routes.get(path);
    if (handler) {
      handler();
    } else {
      const homeHandler = this._routes.get('/');
      if (homeHandler) homeHandler();
    }
  }

  private _getPathFromHash(): string {
    const hash = window.location.hash;
    if (!hash || hash === '#' || hash === '#/') return '/';
    const path = hash.startsWith('#') ? hash.slice(1) : hash;
    return this._normalizePath(path);
  }

  private _normalizePath(path: string): string {
    if (!path || path === '/') return '/';
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return normalized.endsWith('/') && normalized.length > 1
      ? normalized.slice(0, -1)
      : normalized;
  }
}
