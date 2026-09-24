/**
 * home-announcements — Custom Element
 *
 * "League news": the three most recent admin-posted announcements for the
 * current season year (spec 006). Renders nothing if there are none or on
 * error. No shadow DOM; uses global CSS classes.
 */

import type { Timestamp } from 'firebase/firestore';
import { getServices } from '@/services/app-services';
import { escapeHtml } from '@/modules/ui';
import { renderMarkdown } from '@/utils/markdown';
import type { Announcement } from '@/types/announcement';

const { scoreService } = getServices();

const MAX_ITEMS = 3;

function fmtLong(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

class HomeAnnouncements extends HTMLElement {
  connectedCallback(): void {
    void this._load(new Date().getFullYear());
  }

  private async _load(year: number): Promise<void> {
    const card = `
      <div class="news-item skeleton-group">
        <span class="skeleton skeleton--lg" style="width:55%"></span>
        <span class="skeleton skeleton--sm" style="width:90%"></span>
        <span class="skeleton skeleton--sm" style="width:70%"></span>
      </div>`;
    this.innerHTML = `<div class="news">${card.repeat(2)}</div>`;

    const result = await scoreService.getAnnouncements(year);
    const items = result.success ? result.data.slice(0, MAX_ITEMS) : [];
    if (items.length === 0) {
      this.innerHTML = '';
      return;
    }
    this.innerHTML = `
      <section class="news" aria-labelledby="news-title">
        <div class="section-head">
          <div>
            <span class="eyebrow">Announcements</span>
            <h2 id="news-title">League news</h2>
          </div>
        </div>
        <ol class="news-list">${items.map((a) => HomeAnnouncements._item(a)).join('')}</ol>
      </section>`;
  }

  private static _item(ann: Announcement): string {
    const posted = ann.postedAt.toDate();
    const mon = posted.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const edited = ann.lastEditedAt
      ? `<span class="news-item__edited">Edited ${fmtLong(ann.lastEditedAt)}</span>`
      : '';
    return `
      <li class="news-item">
        <div class="news-item__date" aria-hidden="true">
          <span class="news-item__mon">${mon}</span>
          <span class="news-item__day">${posted.getDate()}</span>
        </div>
        <article class="news-item__body">
          <h3 class="news-item__title">${escapeHtml(ann.title)}</h3>
          <p class="news-item__meta"><time datetime="${posted.toISOString()}">Posted ${fmtLong(ann.postedAt)}</time>${edited}</p>
          <div class="news-item__text">${renderMarkdown(ann.body)}</div>
        </article>
      </li>`;
  }
}

customElements.define('home-announcements', HomeAnnouncements);
