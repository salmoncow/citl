/**
 * NavigationModule
 *
 * Manages all navigation interactions:
 * - Burger menu toggle (mobile responsive nav)
 * - Resources dropdown open/close (click + outside-click + Escape)
 * - Scroll progress bar
 * - Active link highlighting per current route
 */

import type { User } from 'firebase/auth';

const MOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const SUN_SVG  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

export class NavigationModule {
  private _topnav: HTMLElement | null = null;
  private _dropdown: HTMLElement | null = null;
  private _burgerBtn: HTMLButtonElement | null = null;
  private _dropBtn: HTMLButtonElement | null = null;
  private _themeToggleBtn: HTMLButtonElement | null = null;
  private _dropdownOpen = false;

  private readonly _boundClickOutsideHandler = this._handleClickOutside.bind(this);
  private readonly _boundKeydownHandler = this._handleKeydown.bind(this);

  init(): void {
    this._topnav = document.getElementById('topnav');
    this._dropdown = document.getElementById('dropdown');
    this._burgerBtn = document.getElementById('burger-btn') as HTMLButtonElement | null;
    this._dropBtn = document.getElementById('dropbtn') as HTMLButtonElement | null;
    this._themeToggleBtn = document.getElementById('theme-toggle') as HTMLButtonElement | null;

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

    document.addEventListener('click', this._boundClickOutsideHandler);
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
    }
  }

  updateAuthState(_user: User | null): void {
    // no-op — wired in main.ts for admin sign-in display
  }

  destroy(): void {
    document.removeEventListener('click', this._boundClickOutsideHandler);
    document.removeEventListener('keydown', this._boundKeydownHandler);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _toggleBurgerNav(): void {
    if (!this._topnav) return;
    this._topnav.classList.toggle('is-open');
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
