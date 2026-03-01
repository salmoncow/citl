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

export class NavigationModule {
  private _topnav: HTMLElement | null = null;
  private _dropdown: HTMLElement | null = null;
  private _progressBar: HTMLElement | null = null;
  private _burgerBtn: HTMLButtonElement | null = null;
  private _dropBtn: HTMLButtonElement | null = null;
  private _dropdownOpen = false;

  private readonly _boundScrollHandler = this._updateProgressBar.bind(this);
  private readonly _boundClickOutsideHandler = this._handleClickOutside.bind(this);
  private readonly _boundKeydownHandler = this._handleKeydown.bind(this);

  init(): void {
    this._topnav = document.getElementById('topnav');
    this._dropdown = document.getElementById('dropdown');
    this._progressBar = document.getElementById('myBar');
    this._burgerBtn = document.getElementById('burger-btn') as HTMLButtonElement | null;
    this._dropBtn = document.getElementById('dropbtn') as HTMLButtonElement | null;

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

  updateAuthState(_user: User | null): void {
    // no-op — wired in main.ts for admin sign-in display
  }

  destroy(): void {
    window.removeEventListener('scroll', this._boundScrollHandler);
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

  private _updateProgressBar(): void {
    if (!this._progressBar) return;
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrollPercent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    this._progressBar.style.width = `${scrollPercent}%`;
  }
}
