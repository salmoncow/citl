/**
 * rules-toc — Custom Element wrapping the Rules layout (spec 006 DD-11)
 *
 * - ≥960px: every section card is open and toggling is suppressed.
 * - <960px: cards collapse (accordion); a TOC click opens its target.
 * - Highlights the TOC entry of the section in view.
 * - "Print rules" expands every section before printing.
 * Scrolling itself is the global in-page link handler (navigation.ts, DD-4).
 * All listeners and observers are torn down in disconnectedCallback.
 */

const DESKTOP = '(min-width: 960px)';

class RulesToc extends HTMLElement {
  private _mq: MediaQueryList | null = null;
  private _observer: IntersectionObserver | null = null;
  private readonly _onMq = (): void => this._applyLayout();
  private readonly _onBeforePrint = (): void => this._setAll(true);
  private readonly _onAfterPrint = (): void => this._applyLayout();
  private readonly _onClick = (e: Event): void => this._handleClick(e);

  connectedCallback(): void {
    this._mq = window.matchMedia(DESKTOP);
    this._mq.addEventListener('change', this._onMq);
    window.addEventListener('beforeprint', this._onBeforePrint);
    window.addEventListener('afterprint', this._onAfterPrint);
    this.addEventListener('click', this._onClick);
    this._applyLayout();
    this._observeSections();
  }

  disconnectedCallback(): void {
    this._mq?.removeEventListener('change', this._onMq);
    window.removeEventListener('beforeprint', this._onBeforePrint);
    window.removeEventListener('afterprint', this._onAfterPrint);
    this.removeEventListener('click', this._onClick);
    this._observer?.disconnect();
    this._observer = null;
  }

  private _cards(): HTMLDetailsElement[] {
    return [...this.querySelectorAll<HTMLDetailsElement>('details.rule-card')];
  }

  private _setAll(open: boolean): void {
    for (const d of this._cards()) d.open = open;
  }

  private _applyLayout(): void {
    this._setAll(this._mq?.matches ?? true);
  }

  private _handleClick(e: Event): void {
    const target = e.target as HTMLElement;
    if (target.closest('[data-print]')) {
      window.print();
      return;
    }
    // Desktop: sections stay open — the summary is a heading, not a toggle.
    if (target.closest('summary') && this._mq?.matches) {
      e.preventDefault();
      return;
    }
    const link = target.closest<HTMLAnchorElement>('a[data-section]');
    if (link) {
      const card = this.querySelector<HTMLDetailsElement>(`#${link.dataset['section'] ?? ''}`);
      if (card) card.open = true;
    }
  }

  private _observeSections(): void {
    if (!('IntersectionObserver' in window)) return;
    const links = new Map(
      [...this.querySelectorAll<HTMLAnchorElement>('a[data-section]')].map((a) => [a.dataset['section'], a]),
    );
    this._observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const [id, a] of links) {
          if (id === entry.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        }
      }
    }, { rootMargin: '-20% 0px -70% 0px' });
    for (const card of this._cards()) this._observer.observe(card);
  }
}

customElements.define('rules-toc', RulesToc);
