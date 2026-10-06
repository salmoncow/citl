/**
 * NavigationModule
 *
 * Manages all navigation interactions:
 * - Burger menu toggle (mobile responsive nav)
 * - Resources dropdown open/close (click + outside-click + Escape)
 * - Scroll progress bar
 * - Active link highlighting per current route
 * - Account slots (spec 008): Sign in / Account / Admin in the header,
 *   plus the footer Admin link. Visibility is UX only; rules and
 *   callables enforce access.
 */

import type { User } from 'firebase/auth';
import type { Role } from '@/types/user';
import { leagueRequestsEnabled } from '@/utils/features';

const MOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const SUN_SVG  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

export class NavigationModule {
  private _topnav: HTMLElement | null = null;
  private _dropdown: HTMLElement | null = null;
  private _burgerBtn: HTMLButtonElement | null = null;
  private _dropBtn: HTMLButtonElement | null = null;
  private _themeToggleBtn: HTMLButtonElement | null = null;
  private _dropdownOpen = false;
  private _onSignIn: ((trigger: HTMLElement) => void) | null = null;

  private readonly _boundClickOutsideHandler = this._handleClickOutside.bind(this);
  private readonly _boundKeydownHandler = this._handleKeydown.bind(this);
  private readonly _boundInPageLinkHandler = this._handleInPageLink.bind(this);

  /**
   * @param opts.onSignIn called when the header Sign in button is pressed;
   *   main.ts lazy-loads and opens the sign-in dialog.
   */
  init(opts: { onSignIn?: (trigger: HTMLElement) => void } = {}): void {
    this._onSignIn = opts.onSignIn ?? null;
    this._topnav = document.getElementById('topnav');
    this._dropdown = document.getElementById('dropdown');
    this._burgerBtn = document.getElementById('burger-btn') as HTMLButtonElement | null;
    this._dropBtn = document.getElementById('dropbtn') as HTMLButtonElement | null;
    this._themeToggleBtn = document.getElementById('theme-toggle') as HTMLButtonElement | null;

    const footerYear = document.getElementById('footer-year');
    if (footerYear) footerYear.textContent = String(new Date().getFullYear());

    if (this._burgerBtn) {
      this._burgerBtn.addEventListener('click', () => this._toggleBurgerNav());
    }

    if (this._themeToggleBtn) {
      this._themeToggleBtn.addEventListener('click', () => this._toggleTheme());
      this._updateThemeIcon();
    }

    if (this._dropBtn) {
      this._dropBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleDropdown();
      });
    }

    const signInBtn = document.getElementById('nav-sign-in');
    signInBtn?.addEventListener('click', () => {
      this.closeBurgerNav();
      this._onSignIn?.(signInBtn);
    });

    document.addEventListener('click', this._boundClickOutsideHandler);
    document.addEventListener('click', this._boundInPageLinkHandler);
    document.addEventListener('keydown', this._boundKeydownHandler);
  }

  setActiveLink(path: string): void {
    if (!this._topnav) return;
    const links = this._topnav.querySelectorAll<HTMLAnchorElement>('a[data-route]');
    links.forEach((link) => {
      const route = link.getAttribute('data-route');
      if (route === path) {
        link.classList.add('is-active');
      } else {
        link.classList.remove('is-active');
      }
    });
  }

  closeDropdown(): void {
    if (this._dropdown) {
      this._dropdown.classList.remove('is-open');
      this._dropdownOpen = false;
      if (this._dropBtn) this._dropBtn.setAttribute('aria-expanded', 'false');
    }
  }

  closeBurgerNav(): void {
    if (this._topnav) {
      this._topnav.classList.remove('is-open');
      this._burgerBtn?.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * React to changes in sign-in state and role:
   *   - header Sign in: shown only when signed out
   *   - header Account: shown only when signed in
   *   - header + footer Admin: shown only for owner/admin
   */
  updateAuthState(user: User | null, role: Role | null): void {
    const signedIn = user !== null;
    const elevated = signedIn && (role === 'owner' || role === 'admin');
    document.getElementById('nav-sign-in')?.toggleAttribute('hidden', signedIn);
    document.getElementById('nav-account-link')?.toggleAttribute('hidden', !signedIn);
    document.getElementById('nav-admin-link')?.toggleAttribute('hidden', !elevated);
    document.querySelector('.footer__admin-link')?.toggleAttribute('hidden', !elevated);
    this._updateJoinCta(signedIn);
  }

  /** Spec 012 AC-1: "Join the league" → #/join, "My league" when signed in; #/about with the flag off. */
  private _updateJoinCta(signedIn: boolean): void {
    const cta = document.querySelector<HTMLAnchorElement>('.site-nav__cta');
    if (!cta || !leagueRequestsEnabled) return;
    cta.href = '#/join';
    cta.textContent = signedIn ? 'My league' : 'Join the league';
  }

  destroy(): void {
    document.removeEventListener('click', this._boundClickOutsideHandler);
    document.removeEventListener('click', this._boundInPageLinkHandler);
    document.removeEventListener('keydown', this._boundKeydownHandler);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _toggleBurgerNav(): void {
    if (!this._topnav) return;
    const open = this._topnav.classList.toggle('is-open');
    this._burgerBtn?.setAttribute('aria-expanded', String(open));
    this.closeDropdown();
  }

  private _toggleDropdown(): void {
    if (!this._dropdown) return;
    this._dropdownOpen = !this._dropdownOpen;
    if (this._dropdownOpen) {
      this._dropdown.classList.add('is-open');
      if (this._dropBtn) this._dropBtn.setAttribute('aria-expanded', 'true');
    } else {
      this.closeDropdown();
    }
  }

  private _handleClickOutside(event: Event): void {
    if (!this._dropdownOpen) return;
    const dropContainer = this._dropBtn ? this._dropBtn.closest('.site-nav__dropdown') : null;
    if (dropContainer && !dropContainer.contains(event.target as Node)) {
      this.closeDropdown();
    }
  }

  /**
   * The hash router owns every `#/…` URL, so a plain fragment link
   * (`href="#standings"`, the skip link) would otherwise navigate Home.
   * Intercept same-page fragments: scroll to the target and move focus to
   * it, without touching the route (spec 006 DD-4).
   */
  private _handleInPageLink(event: Event): void {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link) return;
    const href = link.getAttribute('href') ?? '';
    if (href === '#' || href.startsWith('#/')) return;
    let id: string;
    try {
      id = decodeURIComponent(href.slice(1));
    } catch {
      return; // malformed fragment (e.g. from announcement markdown) — let the browser handle it
    }
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  private _handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this._dropdownOpen) {
      this.closeDropdown();
    }
  }

  private _getCurrentIsDark(): boolean {
    const attr = document.documentElement.getAttribute('data-color-scheme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private _toggleTheme(): void {
    const next = this._getCurrentIsDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-color-scheme', next);
    localStorage.setItem('color-scheme', next);
    this._updateThemeIcon();
  }

  private _updateThemeIcon(): void {
    if (!this._themeToggleBtn) return;
    const isDark = this._getCurrentIsDark();
    // Show sun (→ switch to light) in dark mode; moon (→ switch to dark) in light mode
    this._themeToggleBtn.innerHTML = isDark ? SUN_SVG : MOON_SVG;
    this._themeToggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  }

}
