/**
 * HTML builders for the admin Requests tab (spec 010 AC-1 – AC-4).
 *
 * Pure string factories: every user value goes through escapeHtml().
 * Each card is a <section data-card="{key}"> whose buttons carry
 * data-act; requests-tab.ts wires them and reads the inputs back with
 * readSettings() and readNote().
 */

import { escapeHtml } from '@/modules/ui';
import type { CaptainChange, LeagueTeam, ShooterSetting } from '@/types/league';
import type { Team } from '@/types/score';
import type {
  LinkItem,
  ProposalItem,
  QueueMember,
  RegistrationItem,
  RosterRow,
} from '@/services/league-review-service';
import type { DirectoryEntry } from '@/services/shooter-directory';

export const NOTE_MAX = 500;

/** Prefilled starting average and rookie flag, by shooter name. */
export type Defaults = ReadonlyMap<string, { startingAvg: number; rookie: boolean }>;

let seq = 0;
const uid = (prefix: string) => `${prefix}-${++seq}`;

function when(ts: { toDate(): Date } | null | undefined): string {
  return ts ? ts.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
}

function memberLine(m: QueueMember): string {
  const email = m.email ? ` (${escapeHtml(m.email)})` : '';
  const inactive = m.active ? '' : ' <strong class="req-flag">Account inactive</strong>';
  return `${escapeHtml(m.name)}${email}${inactive}`;
}

function noteField(label: string): string {
  const id = uid('req-note');
  return `
    <div class="ann-editor__field">
      <label for="${id}">${label}</label>
      <textarea id="${id}" class="ann-editor__textarea" rows="2" maxlength="${NOTE_MAX}" data-note></textarea>
    </div>`;
}

function actions(subject: string, buttons: [act: string, label: string, cls: string][]): string {
  return `
    <div class="req-card__error admin-status admin-status--error" role="alert" hidden></div>
    <div class="ann-admin-card__actions req-card__actions">
      ${buttons.map(([act, label, cls]) =>
        `<button type="button" class="${cls}" data-act="${act}" aria-label="${escapeHtml(`${label}: ${subject}`)}">${label}</button>`).join('')}
    </div>`;
}

/** Average + rookie inputs for a shooter new to the team, or the stored values. */
function settingCells(name: string, stored: { startingAvg: number; rookie: boolean } | null, d: Defaults): string {
  if (stored) {
    return `<td>${stored.startingAvg} <span class="req-muted">(on team)</span></td><td>${stored.rookie ? 'Yes' : 'No'}</td>`;
  }
  const def = d.get(name) ?? { startingAvg: 35, rookie: true };
  return `
    <td><input type="number" class="req-avg" min="0" max="50" step="0.01" value="${def.startingAvg}"
      data-setting="${escapeHtml(name)}" aria-label="${escapeHtml(`Starting average, ${name}`)}"></td>
    <td><input type="checkbox" data-rookie="${escapeHtml(name)}" ${def.rookie ? 'checked' : ''}
      aria-label="${escapeHtml(`Rookie, ${name}`)}"></td>`;
}

const STATUS_TEXT: Record<RosterRow['status'], string> = {
  returning: 'On last roster',
  new: 'New',
  dropped: 'Dropped',
};

export function proposalCard(key: string, item: ProposalItem, rows: readonly RosterRow[], lastYear: number | null, d: Defaults): string {
  const p = item.proposal;
  const kind = p.purpose === 'change' ? 'Roster change' : p.teamSource === 'returning' ? 'Returning team' : 'New team';
  const entry = new Map(p.shooters.map((s) => [s.name, s]));
  const headingId = uid('req-h');
  const body = rows.map((r) => {
    const e = entry.get(r.name);
    const minor = e?.minor ? `<span class="req-muted">Under 18${e.guardianName ? `, guardian ${escapeHtml(e.guardianName)}` : ''}</span>` : '';
    if (r.status === 'dropped') {
      return `<tr class="req-row--dropped"><td>${escapeHtml(r.name)}</td><td>${STATUS_TEXT[r.status]}</td><td></td><td></td><td></td></tr>`;
    }
    return `<tr>
      <td>${escapeHtml(r.name)}${e?.kind === 'self' ? ' <span class="req-muted">(captain)</span>' : ''} ${minor}</td>
      <td>${lastYear ? STATUS_TEXT[r.status] : '—'}</td>
      <td>${e?.rookie ? 'Rookie' : ''}</td>
      ${settingCells(r.name, r.stored, d)}
    </tr>`;
  }).join('');
  const competing = item.competing > 0
    ? `<p class="req-warning">${item.competing} other proposal${item.competing === 1 ? '' : 's'} for this team. Approving one sets the captain; reject the others with a note.</p>`
    : '';
  return `
    <section class="ann-admin-card req-card" data-card="${key}" aria-labelledby="${headingId}">
      <div class="ann-admin-card__header">
        <h4 id="${headingId}" class="ann-admin-card__title">${escapeHtml(p.teamName)}</h4>
        <span class="ann-admin-card__meta">${p.year} · ${kind} · Submitted ${when(p.submittedAt)}</span>
      </div>
      <p class="req-line">Captain: ${memberLine(item.member)}</p>
      ${competing}
      <div class="admin-table-wrapper req-table">
        <table class="admin-roster-table">
          <caption class="visually-hidden">Roster for ${escapeHtml(p.teamName)}${lastYear ? `, compared with ${lastYear}` : ''}</caption>
          <thead><tr><th scope="col">Shooter</th><th scope="col">${lastYear ? `vs ${lastYear}` : 'Last season'}</th>
            <th scope="col">Captain says</th><th scope="col">Starting avg</th><th scope="col">Rookie</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      ${noteField('Note to the captain (required to request changes)')}
      ${actions(p.teamName, [['approve', 'Approve', 'btn-primary'], ['request-changes', 'Request changes', 'btn-secondary'], ['reject', 'Reject', 'btn-danger']])}
    </section>`;
}

export function registrationCard(key: string, item: RegistrationItem, names: readonly string[], teams: readonly Team[], preferred: string | null, d: Defaults): string {
  const r = item.registration;
  const headingId = uid('req-h');
  const selectId = uid('req-team');
  const options = teams.map((t) =>
    `<option value="${escapeHtml(t.id)}" ${t.id === r.preferredLeagueTeamId ? 'selected' : ''}>${escapeHtml(t.name)} (${t.shooters.length})</option>`).join('');
  const rows = names.map((name, i) => `<tr>
      <td>${escapeHtml(name)}${i > 0 ? ' <span class="req-muted">Under 18</span>' : ''}</td>
      ${settingCells(name, null, d)}
    </tr>`).join('');
  const teamField = teams.length
    ? `<div class="ann-editor__field">
        <label for="${selectId}">Place on</label>
        <select id="${selectId}" data-team><option value="">Choose a team…</option>${options}</select>
      </div>`
    : `<p class="req-warning">No ${r.year} teams yet. Add the team in Team Management first, or decline.</p>`;
  return `
    <section class="ann-admin-card req-card" data-card="${key}" aria-labelledby="${headingId}">
      <div class="ann-admin-card__header">
        <h4 id="${headingId}" class="ann-admin-card__title">${escapeHtml(item.member.name)}</h4>
        <span class="ann-admin-card__meta">${r.year} · Join request · Sent ${when(r.createdAt)}</span>
      </div>
      <p class="req-line">Member: ${memberLine(item.member)}</p>
      <p class="req-line">Preferred team: ${preferred ? escapeHtml(preferred) : 'No preference'}</p>
      ${r.note ? `<p class="req-line">Their note: ${escapeHtml(r.note)}</p>` : ''}
      ${teamField}
      <div class="admin-table-wrapper req-table">
        <table class="admin-roster-table">
          <caption class="visually-hidden">Shooters to place</caption>
          <thead><tr><th scope="col">Shooter</th><th scope="col">Starting avg</th><th scope="col">Rookie</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${noteField('Note to the member')}
      ${actions(item.member.name, [['place', 'Place on team', 'btn-primary'], ['decline', 'Decline', 'btn-danger']])}
    </section>`;
}

/**
 * Link card (AC-11): the coordinator picks one real scorecard name. The
 * exact match is preselected; close matches cover misspellings. With no
 * candidate the only action is Decline.
 */
export function linkCard(key: string, item: LinkItem, matches: readonly DirectoryEntry[], exact: DirectoryEntry | null): string {
  const headingId = uid('req-h');
  const groupName = uid('req-link');
  const requested = escapeHtml(item.request.shooterName);
  const choices = matches.map((m) => `
      <label class="req-choice">
        <input type="radio" name="${groupName}" value="${escapeHtml(m.name)}" data-link-name ${m === exact ? 'checked' : ''}>
        <span><strong>${escapeHtml(m.name)}</strong>
          <span class="req-muted">${escapeHtml(m.seasons.join(', '))} · ${escapeHtml(m.teams.join(', '))}</span></span>
      </label>`).join('');
  const picker = matches.length
    ? `<fieldset class="req-choices">
        <legend>${exact ? 'Link to this scorecard name' : `No exact match for “${requested}”. Pick the right name, or decline`}</legend>
        ${choices}
      </fieldset>`
    : `<p class="req-warning">“${requested}” isn’t on any scorecard and nothing close matches. Decline with a note asking them to pick their name from the list.</p>`;
  const buttons: [string, string, string][] = matches.length
    ? [['approve', 'Approve link', 'btn-primary'], ['decline', 'Decline', 'btn-danger']]
    : [['decline', 'Decline', 'btn-danger']];
  return `
    <section class="ann-admin-card req-card" data-card="${key}" aria-labelledby="${headingId}">
      <div class="ann-admin-card__header">
        <h4 id="${headingId}" class="ann-admin-card__title">${requested}</h4>
        <span class="ann-admin-card__meta">Scorecard name · Sent ${when(item.request.createdAt)}</span>
      </div>
      <p class="req-line">Member: ${memberLine(item.member)}</p>
      ${item.request.note ? `<p class="req-line">Their note: ${escapeHtml(item.request.note)}</p>` : ''}
      ${picker}
      ${noteField('Note to the member')}
      ${actions(item.request.shooterName, buttons)}
    </section>`;
}

export function handoffCard(key: string, c: CaptainChange): string {
  const headingId = uid('req-h');
  return `
    <section class="ann-admin-card req-card" data-card="${key}" aria-labelledby="${headingId}">
      <div class="ann-admin-card__header">
        <h4 id="${headingId}" class="ann-admin-card__title">${escapeHtml(c.teamName)}</h4>
        <span class="ann-admin-card__meta">Captain handoff · Accepted by the nominee</span>
      </div>
      <p class="req-line">From ${escapeHtml(c.fromName)} to ${escapeHtml(c.toName)}</p>
      ${noteField('Note')}
      ${actions(c.teamName, [['approve', 'Approve handoff', 'btn-primary'], ['decline', 'Decline', 'btn-danger']])}
    </section>`;
}

export function captainsTable(rows: readonly { team: LeagueTeam; captain: QueueMember }[]): string {
  if (!rows.length) return '<p class="req-muted">No team has a captain yet.</p>';
  return `
    <div class="admin-table-wrapper req-table">
      <table class="admin-roster-table">
        <caption class="visually-hidden">League teams with a captain</caption>
        <thead><tr><th scope="col">Team</th><th scope="col">Captain</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
        <tbody>${rows.map(({ team, captain }) => `<tr data-card="captain:${escapeHtml(team.id)}">
          <td>${escapeHtml(team.name)}</td>
          <td>${memberLine(captain)}</td>
          <td><button type="button" class="btn-secondary" data-act="clear"
            aria-label="${escapeHtml(`Remove captain: ${team.name}`)}">Remove captain</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

/** Starting averages and rookie flags entered on a card. */
export function readSettings(card: HTMLElement): ShooterSetting[] {
  return [...card.querySelectorAll<HTMLInputElement>('input[data-setting]')].map((input) => {
    const name = input.dataset['setting'] ?? '';
    const rookie = [...card.querySelectorAll<HTMLInputElement>('input[data-rookie]')]
      .find((c) => c.dataset['rookie'] === name)?.checked ?? false;
    return { name, startingAvg: input.value === '' ? Number.NaN : Number(input.value), rookie };
  });
}

export function readNote(card: HTMLElement): string | null {
  const v = card.querySelector<HTMLTextAreaElement>('[data-note]')?.value.trim() ?? '';
  return v ? v : null;
}
