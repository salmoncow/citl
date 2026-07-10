/**
 * home-announcements — Custom Element
 *
 * Displays admin-posted announcements for the current season year.
 * Silently renders nothing if there are no announcements or on error.
 * No shadow DOM; uses global CSS classes.
 */

import { db } from '@/firebase-config';
import { createRepositoryFactory } from '@/repositories/repository-factory';
import { ScoreService } from '@/services/score-service';
import { escapeHtml } from '@/modules/ui';
import { renderMarkdown } from '@/utils/markdown';
import type { Announcement } from '@/types/announcement';

const factory = createRepositoryFactory({ db });
const scoreService = new ScoreService(factory.getScoreRepository());

class HomeAnnouncements extends HTMLElement {
  connectedCallback(): void {
    const year = new Date().getFullYear();
    void this._load(year);
  }

  private async _load(year: number): Promise<void> {
    this.innerHTML = `
      <div class="skeleton-group" style="padding:var(--space-4) 0">
        <span class="skeleton skeleton--lg" style="width:55%"></span>
        <span class="skeleton skeleton--sm" style="width:90%"></span>
        <span class="skeleton skeleton--sm" style="width:80%"></span>
        <span class="skeleton skeleton--sm" style="width:65%"></span>
      </div>`;
    const result = await scoreService.getAnnouncements(year);
    const latest = result.success ? result.data[0] : undefined;
    if (!latest) {
      this.innerHTML = '';
      return;
    }
    this._render(latest);
  }

  private _render(ann: Announcement): void {
    const fmt = (ts: import('firebase/firestore').Timestamp) =>
      ts.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const escapedTitle = escapeHtml(ann.title);

    const editedSpan = ann.lastEditedAt
      ? `<span class="ann-card__edited">Edited ${fmt(ann.lastEditedAt)}</span>`
      : '';

    this.innerHTML = `
      <section class="ann-section">
        <h2 class="ann-section__heading">Announcements</h2>
        <div class="ann-card-list">
          <article class="ann-card">
            <header class="ann-card__header">
              <h3 class="ann-card__title">${escapedTitle}</h3>
              <div class="ann-card__meta">
                <span>Posted ${fmt(ann.postedAt)}</span>
                ${editedSpan}
              </div>
            </header>
            <div class="ann-card__body">${renderMarkdown(ann.body)}</div>
          </article>
        </div>
      </section>`;
  }
}

customElements.define('home-announcements', HomeAnnouncements);
