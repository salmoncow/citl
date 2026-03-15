/**
 * site-banner — Custom Element
 *
 * Displays a site-wide notification banner below the nav when a message is set.
 * Hidden entirely (no layout impact) when no message is configured.
 * Message is always rendered via textContent to prevent XSS.
 */

import { db } from '@/firebase-config';
import { createRepositoryFactory } from '@/repositories/repository-factory';
import { ScoreService } from '@/services/score-service';

const factory = createRepositoryFactory({ db });
const scoreService = new ScoreService(factory.getScoreRepository());

class SiteBanner extends HTMLElement {
  connectedCallback(): void {
    void this._load();
  }

  private async _load(): Promise<void> {
    const result = await scoreService.getBanner();
    const message = result.success ? result.data : null;
    if (!message) { this.hidden = true; return; }
    this.hidden = false;
    this.innerHTML = `
      <div class="site-banner__inner">
        <span class="site-banner__icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0
              1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </span>
        <p class="site-banner__text"></p>
      </div>`;
    this.querySelector('.site-banner__text')!.textContent = message;
  }
}

customElements.define('site-banner', SiteBanner);
