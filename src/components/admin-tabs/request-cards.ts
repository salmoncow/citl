/**
 * Ticket builders for the admin Requests tab (spec 010 AC-1 – AC-4).
 *
 * Pure string factories: every user value goes through escapeHtml().
 * Each request becomes a Ticket: the row summary for the queue list
 * (request-list.ts) plus the detail body and action buttons shown in the
 * ticket dialog. The dialog wraps them in <div data-card="{key}">; the
 * buttons carry data-act, and requests-tab.ts reads the inputs back with
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

export type TicketKind = 'proposal' | 'registration' | 'link' | 'handoff';

/** One request in the queue: what its row shows and what its dialog holds. */
export interface Ticket {
  key: string;
  kind: TicketKind;
  title: string;
  subtitle: string;
  requester: string;
  season: number | null;
  date: Date | null;
  /** Short plain-text flags shown as pills on the row. */
  flags: string[];
  /** Dialog meta line under the title (plain text). */
  meta: string;
  /** Dialog body markup. */
  body: string;
  /** Dialog footer markup: the error box and the action buttons. */
  actions: string;
}

let seq = 0;
const uid = (prefix: string) => `${prefix}-${++seq}`;

function when(ts: { toDate(): Date } | null | undefined): string {
  return ts ? ts.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
}

const dateOf = (ts: { toDate(): Date } | null | undefined): Date | null => (ts ? ts.toDate() : null);

const inactiveFlag = (m: QueueMember): string[] => (m.active ? [] : ['Account inactive']);

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

export function proposalTicket(key: string, item: ProposalItem, rows: readonly RosterRow[], lastYear: number | null, d: Defaults): Ticket {
  const p = item.proposal;
  const kind = p.purpose === 'change' ? 'Roster change' : p.teamSource === 'returning' ? 'Returning team' : 'New team';
  const entry = new Map(p.shooters.map((s) => [s.name, s]));
  const body = rows.map((r) => {
    const e = entry.get(r.name);
    const minor = e?.minor ? `<span class="req-muted">Under 18${e.guardianName ? `, guardian ${escapeHtml(e.guardianName)}` : ''}</span>` : '';
    if (r.status === 'dropped') {
      const onTeam = r.stored ? ` <span class="req-muted">(on the ${p.year} team now)</span>` : '';
      return `<tr class="req-row--dropped"><td>${escapeHtml(r.name)}</td><td>${STATUS_TEXT[r.status]}${onTeam}</td><td></td><td></td><td></td></tr>`;
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
  const droppedNow = rows.filter((r) => r.status === 'dropped' && r.stored).length;
  const removes = droppedNow
    ? `<p class="req-warning">Approving removes ${droppedNow} shooter${droppedNow === 1 ? '' : 's'} already on the ${p.year} team (marked below).</p>`
    : '';
  return {
    key,
    kind: 'proposal',
    title: p.teamName,
    subtitle: `${kind} · ${p.shooters.length} shooter${p.shooters.length === 1 ? '' : 's'}`,
    requester: item.member.name,
    season: p.year,
    date: dateOf(p.submittedAt),
    flags: [...(item.competing > 0 ? ['Competing'] : []), ...(droppedNow ? ['Removes shooters'] : []), ...inactiveFlag(item.member)],
    meta: `${p.year} · ${kind} · Submitted ${when(p.submittedAt)}`,
    body: `
      <p class="req-line">Captain: ${memberLine(item.member)}</p>
      ${competing}
      ${removes}
      <div class="admin-table-wrapper req-table">
        <table class="admin-roster-table">
          <caption class="visually-hidden">Roster for ${escapeHtml(p.teamName)}${lastYear ? `, compared with ${lastYear}` : ''}</caption>
          <thead><tr><th scope="col">Shooter</th><th scope="col">${lastYear ? `vs ${lastYear}` : 'Last season'}</th>
            <th scope="col">Captain says</th><th scope="col">Starting avg</th><th scope="col">Rookie</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      ${noteField('Note to the captain (required to request changes)')}`,
    actions: actions(p.teamName, [['approve', 'Approve', 'btn-primary'], ['request-changes', 'Request changes', 'btn-secondary'], ['reject', 'Reject', 'btn-danger']]),
  };
}

export function registrationTicket(key: string, item: RegistrationItem, names: readonly string[], teams: readonly Team[], preferred: string | null, d: Defaults): Ticket {
  const r = item.registration;
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
  const extra = names.length - 1;
  return {
    key,
    kind: 'registration',
    title: item.member.name,
    subtitle: `Join request${extra > 0 ? ` · +${extra} under 18` : ''} · ${preferred ? `Prefers ${preferred}` : 'No preference'}`,
    requester: item.member.name,
    season: r.year,
    date: dateOf(r.createdAt),
    flags: [...(teams.length ? [] : ['No teams yet']), ...inactiveFlag(item.member)],
    meta: `${r.year} · Join request · Sent ${when(r.createdAt)}`,
    body: `
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
      ${noteField('Note to the member')}`,
    actions: actions(item.member.name, [['place', 'Place on team', 'btn-primary'], ['decline', 'Decline', 'btn-danger']]),
  };
}

/**
 * Link ticket (AC-11): the coordinator picks one real scorecard name. The
 * exact match is preselected; close matches cover misspellings. With no
 * candidate the only action is Decline.
 */
export function linkTicket(key: string, item: LinkItem, matches: readonly DirectoryEntry[], exact: DirectoryEntry | null): Ticket {
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
  const match = exact ? [] : matches.length ? ['No exact match'] : ['No match'];
  return {
    key,
    kind: 'link',
    title: `“${item.request.shooterName}”`,
    subtitle: exact ? 'Scorecard name · exact match' : `Scorecard name · ${matches.length} close match${matches.length === 1 ? '' : 'es'}`,
    requester: item.member.name,
    season: null,
    date: dateOf(item.request.createdAt),
    flags: [...match, ...inactiveFlag(item.member)],
    meta: `Scorecard name · Sent ${when(item.request.createdAt)}`,
    body: `
      <p class="req-line">Member: ${memberLine(item.member)}</p>
      ${item.request.note ? `<p class="req-line">Their note: ${escapeHtml(item.request.note)}</p>` : ''}
      ${picker}
      ${noteField('Note to the member')}`,
    actions: actions(item.request.shooterName, buttons),
  };
}

export function handoffTicket(key: string, c: CaptainChange): Ticket {
  return {
    key,
    kind: 'handoff',
    title: c.teamName,
    subtitle: `Captain handoff · ${c.fromName} → ${c.toName}`,
    requester: c.fromName,
    season: null,
    date: dateOf(c.createdAt),
    flags: [],
    meta: 'Captain handoff · Accepted by the nominee',
    body: `
      <p class="req-line">From ${escapeHtml(c.fromName)} to ${escapeHtml(c.toName)}</p>
      ${noteField('Note')}`,
    actions: actions(c.teamName, [['approve', 'Approve handoff', 'btn-primary'], ['decline', 'Decline', 'btn-danger']]),
  };
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
