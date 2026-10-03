/**
 * Shooter link request dialog (spec 009 AC-15, AC-16, DD-7): the member
 * picks the name they shot under on past scorecards. A search over every
 * season's rosters (cached reads, loaded when the dialog opens) shows
 * each match with its seasons and teams; any name can also be typed.
 * The coordinator approves the link (M3).
 */

import { escapeHtml } from '@/modules/ui';
import { getServices } from '@/services/app-services';
import { getMemberLeagueService, resultMessage } from '@/services/member-league-service';
import { LINK_NAME_MAX, NOTE_MAX } from '@/services/league-validation';
import { loadShooterDirectory, searchDirectory, type DirectoryEntry } from '@/services/shooter-directory';
import type { ShooterLinkRequest } from '@/types/league';
import { openFormDialog } from '@/components/league-dialog';

export interface LinkDialogOptions {
  uid: string;
  existing: ShooterLinkRequest | null;
  /** Prefill when there is no request yet (the profile name). */
  defaultName: string;
}

let idCounter = 0;

function renderMatches(list: HTMLElement, status: HTMLElement, matches: DirectoryEntry[], query: string): void {
  list.innerHTML = matches.map((m) => `
    <li>
      <button type="button" class="league-match" data-name="${escapeHtml(m.name)}">
        <span class="league-list__name">${escapeHtml(m.name)}</span>
        <span class="league-list__meta">${escapeHtml(m.seasons.join(', '))} · ${escapeHtml(m.teams.join(', '))}</span>
      </button>
    </li>`).join('');
  status.textContent = !query.trim()
    ? ''
    : matches.length === 0
      ? 'No scorecard names match. You can still send the name as typed.'
      : `${matches.length} matching name${matches.length === 1 ? '' : 's'}. Choose one, or keep the name as typed.`;
}

export function openShooterLinkDialog(opts: LinkDialogOptions): Promise<boolean> {
  const id = `link-${++idCounter}`;
  const editing = opts.existing?.status === 'submitted';
  const name = opts.existing?.shooterName ?? opts.defaultName;
  const fieldsHtml = `
    <p class="account-confirm__body">Link your account to your name on league scorecards. The coordinator confirms it.</p>
    <div class="account-field">
      <label class="account-field__label" for="${id}-name">Name on scorecards</label>
      <input id="${id}-name" name="shooterName" class="account-field__input" type="text" autocomplete="off"
             maxlength="${LINK_NAME_MAX}" value="${escapeHtml(name)}" aria-describedby="${id}-status" required>
      <p id="${id}-status" class="account-field__hint" aria-live="polite">Loading scorecard names…</p>
      <ul class="league-matches" aria-label="Matching scorecard names"></ul>
    </div>
    <div class="account-field">
      <label class="account-field__label" for="${id}-note">Note <span class="account-required">(optional)</span></label>
      <textarea id="${id}-note" name="note" class="account-field__input league-textarea" maxlength="${NOTE_MAX}"
                rows="2" placeholder="e.g. Also shot as Patrick in 2019">${escapeHtml(opts.existing?.note ?? '')}</textarea>
    </div>`;

  let directory: DirectoryEntry[] = [];
  return openFormDialog({
    title: editing ? 'Edit your scorecard name' : 'Link your scorecard name',
    fieldsHtml,
    submitLabel: editing ? 'Save' : 'Send request',
    onOpen: (form) => {
      const input = form.querySelector<HTMLInputElement>(`#${id}-name`)!;
      const status = form.querySelector<HTMLElement>(`#${id}-status`)!;
      const list = form.querySelector<HTMLElement>('.league-matches')!;
      const update = () => renderMatches(list, status, searchDirectory(directory, input.value), input.value);
      input.addEventListener('input', update);
      list.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-name]');
        if (!btn) return;
        input.value = btn.dataset['name'] ?? '';
        update();
        input.focus();
      });
      void loadShooterDirectory(getServices().scoreService).then((res) => {
        if (!res.success) {
          status.textContent = 'Couldn’t load scorecard names. You can still type yours.';
          return;
        }
        directory = res.data;
        update();
      });
    },
    onSubmit: async (form) => {
      const data = new FormData(form);
      const res = await getMemberLeagueService().saveLinkRequest(opts.uid, {
        shooterName: String(data.get('shooterName') ?? ''),
        note: String(data.get('note') ?? ''),
      }, opts.existing?.status ?? null);
      return res.success ? null : resultMessage(res);
    },
  });
}
