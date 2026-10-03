/**
 * Join a team dialog (spec 009 F9, AC-13, AC-14): an individual
 * registration for one season, optionally with dependents, a preferred
 * league team, and a note. The coordinator places the member (M3).
 */

import { escapeHtml } from '@/modules/ui';
import { getMemberLeagueService, resultMessage } from '@/services/member-league-service';
import { NOTE_MAX, minorDisplayName } from '@/services/league-validation';
import type { Dependent, LeagueTeam, Registration } from '@/types/league';
import { openFormDialog } from '@/components/league-dialog';

export interface RegistrationDialogOptions {
  uid: string;
  year: number;
  existing: Registration | null;
  dependents: readonly Dependent[];
  leagueTeams: readonly LeagueTeam[];
}

let idCounter = 0;

export function openRegistrationDialog(opts: RegistrationDialogOptions): Promise<boolean> {
  const id = `reg-${++idCounter}`;
  const chosen = new Set(opts.existing?.dependentIds ?? []);
  const deps = opts.dependents.length === 0 ? '' : `
    <fieldset class="league-fieldset">
      <legend class="account-field__label">Dependents joining with you</legend>
      ${opts.dependents.map((d) => `
        <label class="account-check">
          <input type="checkbox" name="dependentIds" value="${escapeHtml(d.id)}" ${chosen.has(d.id) ? 'checked' : ''}>
          <span>${escapeHtml(minorDisplayName(d.firstName, d.lastName))}</span>
        </label>`).join('')}
      <p class="account-field__hint">Dependents are always placed on your team.</p>
    </fieldset>`;
  const preferred = opts.existing?.preferredLeagueTeamId ?? '';
  const teams = opts.leagueTeams.map((t) =>
    `<option value="${escapeHtml(t.id)}" ${t.id === preferred ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');

  const fieldsHtml = `
    <p class="account-confirm__body">Ask the league coordinator to place you on a team for the ${opts.year} season.</p>
    ${deps}
    <div class="account-field">
      <label class="account-field__label" for="${id}-team">Preferred team <span class="account-required">(optional)</span></label>
      <select id="${id}-team" name="preferredLeagueTeamId" class="account-field__input">
        <option value="">No preference</option>
        ${teams}
      </select>
    </div>
    <div class="account-field">
      <label class="account-field__label" for="${id}-note">Note for the coordinator <span class="account-required">(optional)</span></label>
      <textarea id="${id}-note" name="note" class="account-field__input league-textarea" maxlength="${NOTE_MAX}"
                rows="3" aria-describedby="${id}-note-hint">${escapeHtml(opts.existing?.note ?? '')}</textarea>
      <p id="${id}-note-hint" class="account-field__hint">Up to ${NOTE_MAX} characters, e.g. which nights you can shoot.</p>
    </div>`;

  return openFormDialog({
    title: opts.existing ? 'Edit your request' : 'Join a team',
    fieldsHtml,
    submitLabel: opts.existing ? 'Save' : 'Send request',
    onSubmit: async (form) => {
      const data = new FormData(form);
      const res = await getMemberLeagueService().saveRegistration(opts.uid, opts.year, {
        dependentIds: data.getAll('dependentIds').map(String),
        preferredLeagueTeamId: String(data.get('preferredLeagueTeamId') ?? '') || null,
        note: String(data.get('note') ?? ''),
      }, opts.existing !== null);
      return res.success ? null : resultMessage(res);
    },
  });
}
