/**
 * Announcements tab — site banner editor + per-year announcements list.
 *
 * Banner is a singleton document (no year scoping); announcements are
 * per-year and rendered as cards with edit/delete buttons. Both share
 * a status line per editor for inline feedback.
 */

import { ScoreService } from '@/services/score-service';
import { showToast } from '@/modules/ui';
import type { Announcement } from '@/types/announcement';
import type { Timestamp } from 'firebase/firestore';
import { setStatus, showConfirmDialog } from './admin-shared';
import type { AdminTab, AdminTabContext } from './types';

export class AnnouncementsTab implements AdminTab {
  private _host: HTMLElement | null = null;
  private _ctx: AdminTabContext | null = null;
  private readonly _scoreService: ScoreService;

  private _bannerLoaded = false;
  /** null = not editing; else = announcement id being edited. */
  private _editingAnnouncementId: string | null = null;

  constructor(scoreService: ScoreService) {
    this._scoreService = scoreService;
  }

  mount(host: HTMLElement, ctx: AdminTabContext): void {
    this._host = host;
    this._ctx = ctx;

    host.innerHTML = `
      <h3>Site Banner</h3>
      <p class="admin-publish-note">
        Displays a message to all visitors below the navigation bar. Clear the field and save to remove it.
      </p>
      <div class="banner-editor ann-editor">
        <div class="ann-editor__field">
          <label for="banner-msg">Banner message</label>
          <textarea id="banner-msg" class="ann-editor__textarea" rows="3"
            placeholder="e.g. Tonight&#39;s shoot is cancelled due to severe weather."></textarea>
        </div>
        <div class="ann-editor__actions">
          <button id="banner-save-btn" class="btn-primary">Save Banner</button>
          <button id="banner-clear-btn" class="btn-secondary">Clear Banner</button>
        </div>
        <p id="banner-status" class="admin-status" aria-live="polite"></p>
      </div>
      <hr class="admin-divider">
      <h3>Announcements</h3>
      <div class="ann-editor">
        <div class="ann-editor__field">
          <label for="ann-title">Title</label>
          <input type="text" id="ann-title" class="ann-editor__input" placeholder="Announcement title" />
        </div>
        <div class="ann-editor__field">
          <label for="ann-body">Message (Markdown)</label>
          <textarea id="ann-body" class="ann-editor__textarea" rows="6"
            placeholder="Write your announcement..."></textarea>
        </div>
        <div class="ann-editor__actions">
          <button id="ann-post-btn" class="btn-primary">Post Announcement</button>
          <button id="ann-cancel-btn" class="btn-secondary" style="display:none">Cancel Edit</button>
        </div>
        <p id="ann-status" class="admin-status" aria-live="polite"></p>
      </div>
      <div id="ann-list"></div>`;

    host.querySelector('#banner-save-btn')!.addEventListener('click', () => void this._saveBanner());
    host.querySelector('#banner-clear-btn')!.addEventListener('click', () => void this._clearBanner());

    host.querySelector('#ann-post-btn')!.addEventListener('click', () => {
      if (this._editingAnnouncementId) void this._saveEditAnnouncement();
      else void this._postAnnouncement();
    });
    host.querySelector('#ann-cancel-btn')!.addEventListener('click', () => this._clearAnnEditor());
  }

  onYearChange(): void {
    // Banner is global, but announcements are per-year — reload if visible.
    void this._loadAnnouncementsTab();
  }

  onActivate(): void {
    void this._loadBannerTab();
    void this._loadAnnouncementsTab();
  }

  // ── Banner ──────────────────────────────────────────────────────────────

  private async _loadBannerTab(): Promise<void> {
    if (this._bannerLoaded) return;
    const result = await this._scoreService.getBanner();
    if (!result.success) { this._setBannerStatus(`Error: ${result.error}`, 'error'); return; }
    const ta = this._host?.querySelector<HTMLTextAreaElement>('#banner-msg');
    if (ta) ta.value = result.data ?? '';
    this._bannerLoaded = true;
  }

  private async _saveBanner(): Promise<void> {
    const message = this._host?.querySelector<HTMLTextAreaElement>('#banner-msg')!.value.trim() ?? '';
    this._setBannerStatus('Saving…', '');
    const result = await this._scoreService.setBanner(message || null);
    if (!result.success) { this._setBannerStatus(`Error: ${result.error}`, 'error'); return; }
    this._bannerLoaded = false;
    showToast('success', message ? 'Banner updated.' : 'Banner cleared.');
    this._setBannerStatus('', '');
  }

  private async _clearBanner(): Promise<void> {
    const ta = this._host?.querySelector<HTMLTextAreaElement>('#banner-msg');
    if (ta) ta.value = '';
    await this._saveBanner();
  }

  private _setBannerStatus(message: string, type: '' | 'success' | 'error'): void {
    setStatus(this._host?.querySelector('#banner-status') ?? null, message, type);
  }

  // ── Announcements ───────────────────────────────────────────────────────

  private async _loadAnnouncementsTab(): Promise<void> {
    const year = this._ctx?.getYear() ?? 0;
    const result = await this._scoreService.getAnnouncements(year);
    if (!result.success) {
      this._setAnnStatus(`Error loading announcements: ${result.error}`, 'error');
      return;
    }
    this._renderAnnAdminList(result.data);
  }

  private _renderAnnAdminList(announcements: Announcement[]): void {
    const list = this._host?.querySelector('#ann-list');
    if (!list) return;
    list.innerHTML = '';

    if (announcements.length === 0) {
      list.innerHTML = '<p style="color:var(--c-text-muted);font-size:var(--text-sm)">No announcements for this year.</p>';
      return;
    }

    const fmt = (ts: Timestamp) =>
      ts.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    for (const ann of announcements) {
      const card = document.createElement('div');
      card.className = 'ann-admin-card';

      const editedMeta = ann.lastEditedAt
        ? `<span> · Edited ${fmt(ann.lastEditedAt)}</span>`
        : '';

      card.innerHTML = `
        <div class="ann-admin-card__header">
          <span class="ann-admin-card__title"></span>
          <span class="ann-admin-card__meta">Posted ${fmt(ann.postedAt)}${editedMeta}</span>
        </div>
        <pre class="ann-admin-card__body"></pre>
        <div class="ann-admin-card__actions">
          <button class="btn-secondary ann-edit-btn" data-id="${ann.id}" data-year="${ann.year}">Edit</button>
          <button class="btn-danger ann-delete-btn" data-id="${ann.id}" data-year="${ann.year}">Delete</button>
        </div>`;

      card.querySelector('.ann-admin-card__title')!.textContent = ann.title;
      card.querySelector('.ann-admin-card__body')!.textContent = ann.body;

      list.appendChild(card);
    }

    for (const btn of list.querySelectorAll<HTMLButtonElement>('.ann-edit-btn')) {
      btn.addEventListener('click', () => {
        const ann = announcements.find((a) => a.id === btn.dataset['id']);
        if (ann) this._startEditAnnouncement(ann.id, ann.title, ann.body);
      });
    }

    for (const btn of list.querySelectorAll<HTMLButtonElement>('.ann-delete-btn')) {
      btn.addEventListener('click', () => {
        const id = btn.dataset['id'] ?? '';
        const year = parseInt(btn.dataset['year'] ?? '0', 10);
        const ann = announcements.find((a) => a.id === id);
        void this._deleteAnnouncement(id, year, ann?.title ?? id);
      });
    }
  }

  private async _postAnnouncement(): Promise<void> {
    const host = this._host;
    if (!host) return;
    const year = this._ctx?.getYear() ?? 0;
    const title = host.querySelector<HTMLInputElement>('#ann-title')!.value.trim();
    const body = host.querySelector<HTMLTextAreaElement>('#ann-body')!.value.trim();

    if (!title || !body) {
      this._setAnnStatus('Title and message are required.', 'error');
      return;
    }

    this._setAnnStatus('Posting…', '');
    const result = await this._scoreService.createAnnouncement(year, title, body);
    if (!result.success) {
      this._setAnnStatus(`Error: ${result.error}`, 'error');
      return;
    }
    this._clearAnnEditor();
    void this._loadAnnouncementsTab();
  }

  private _startEditAnnouncement(id: string, title: string, body: string): void {
    const host = this._host;
    if (!host) return;
    host.querySelector<HTMLInputElement>('#ann-title')!.value = title;
    host.querySelector<HTMLTextAreaElement>('#ann-body')!.value = body;
    this._editingAnnouncementId = id;
    host.querySelector<HTMLButtonElement>('#ann-post-btn')!.textContent = 'Save Changes';
    host.querySelector<HTMLButtonElement>('#ann-cancel-btn')!.style.display = '';
    host.querySelector('#ann-status')!.textContent = '';
    host.querySelector('#ann-title')!.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  private async _saveEditAnnouncement(): Promise<void> {
    const host = this._host;
    if (!host) return;
    const id = this._editingAnnouncementId!;
    const year = this._ctx?.getYear() ?? 0;
    const title = host.querySelector<HTMLInputElement>('#ann-title')!.value.trim();
    const body = host.querySelector<HTMLTextAreaElement>('#ann-body')!.value.trim();

    if (!title || !body) {
      this._setAnnStatus('Title and message are required.', 'error');
      return;
    }

    this._setAnnStatus('Saving…', '');
    const result = await this._scoreService.updateAnnouncement(id, year, title, body);
    if (!result.success) {
      this._setAnnStatus(`Error: ${result.error}`, 'error');
      return;
    }
    this._clearAnnEditor();
    void this._loadAnnouncementsTab();
  }

  private async _deleteAnnouncement(id: string, year: number, title: string): Promise<void> {
    const confirmed = await showConfirmDialog({
      title: 'Delete Announcement',
      warning: `This will permanently delete "${title}". This cannot be undone.`,
      nameToType: title,
      deleteLabel: 'Delete Announcement',
    });
    if (!confirmed) return;
    const result = await this._scoreService.deleteAnnouncement(id, year);
    if (result.success) {
      showToast('success', `Announcement "${title}" deleted.`);
      void this._loadAnnouncementsTab();
    } else {
      showToast('error', `Failed to delete announcement: ${result.error}`);
    }
  }

  private _clearAnnEditor(): void {
    const host = this._host;
    if (!host) return;
    host.querySelector<HTMLInputElement>('#ann-title')!.value = '';
    host.querySelector<HTMLTextAreaElement>('#ann-body')!.value = '';
    this._editingAnnouncementId = null;
    host.querySelector<HTMLButtonElement>('#ann-post-btn')!.textContent = 'Post Announcement';
    host.querySelector<HTMLButtonElement>('#ann-cancel-btn')!.style.display = 'none';
    host.querySelector('#ann-status')!.textContent = '';
  }

  private _setAnnStatus(message: string, type: '' | 'success' | 'error'): void {
    setStatus(this._host?.querySelector('#ann-status') ?? null, message, type);
  }
}
