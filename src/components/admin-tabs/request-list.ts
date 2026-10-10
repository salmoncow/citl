/**
 * Queue list for the admin Requests tab: ticket rows, filter chips, the
 * Queue | Captains toggle, the ticket dialog content, and the order
 * dependencies between requests.
 *
 * Pure: no DOM or Firestore access, so it is unit tested directly. Every
 * user value goes through escapeHtml().
 *
 * Order dependencies (advisory; the reviewRequest handlers still refuse
 * the hard failures). A decision reads current state when it runs, so:
 *   D1  a member's scorecard-name link goes before their join request or
 *       team proposal (both resolve the roster name from the link);
 *   D2  team proposals for a season go before join requests for it
 *       (approving a proposal replaces that team's roster);
 *   D4  once a team has a captain, a competing proposal can only be rejected;
 *   D5  a captain's roster change goes before a handoff on the same team.
 */

import { escapeHtml } from '@/modules/ui';
import type { ReviewQueue } from '@/services/league-review-service';
import type { Ticket, TicketKind } from './request-cards';

export type QueueFilter = TicketKind | 'all';
export type QueueView = 'queue' | 'captains';

/** Ticket keys are stable per load: kind prefix + index in the queue list. */
export const ticketKey = {
  proposal: (i: number) => `p${i}`,
  registration: (i: number) => `r${i}`,
  link: (i: number) => `l${i}`,
  handoff: (i: number) => `h${i}`,
} as const;

export const KIND_LABEL: Record<TicketKind, string> = {
  proposal: 'Team',
  registration: 'Join',
  link: 'Name',
  handoff: 'Handoff',
};

/** What an "Open …" link in the dialog calls a ticket; with the requester, tickets for one team differ. */
const KIND_NOUN: Record<TicketKind, string> = {
  proposal: 'team proposal',
  registration: 'join request',
  link: 'name link',
  handoff: 'captain handoff',
};

const FILTER_LABEL: Record<QueueFilter, string> = {
  all: 'All',
  proposal: 'Team proposals',
  registration: 'Join requests',
  link: 'Scorecard names',
  handoff: 'Captain handoffs',
};

const EMPTY_TEXT: Record<QueueFilter, string> = {
  all: 'Nothing is waiting for review.',
  proposal: 'No team proposals waiting.',
  registration: 'No join requests waiting.',
  link: 'No link requests waiting.',
  handoff: 'No handoffs waiting.',
};

export interface DependencyNote {
  text: string;
  /** Tickets the note points at, opened from the dialog. */
  open: string[];
}

export interface Dependency {
  pills: string[];
  notes: DependencyNote[];
  /** Tickets to decide first. */
  blockedBy: string[];
}

const DAY_MS = 86_400_000;

/** "Today", "3d", or a short date once a request is two months old. */
export function relativeAge(date: Date | null, now: Date): string {
  if (!date) return '';
  const days = Math.floor((now.getTime() - date.getTime()) / DAY_MS);
  if (days < 1) return 'Today';
  if (days < 60) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Oldest first (undated last, stable), then each ticket that waits on
 * others moves directly after the last of them.
 */
export function sortTickets(tickets: readonly Ticket[], deps: ReadonlyMap<string, Dependency>): Ticket[] {
  const base = tickets
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const da = a.t.date?.getTime() ?? Infinity;
      const db = b.t.date?.getTime() ?? Infinity;
      return da === db ? a.i - b.i : da - db;
    })
    .map(({ t }) => t);
  const present = new Set(base.map((t) => t.key));
  const waits = (t: Ticket) => (deps.get(t.key)?.blockedBy ?? []).filter((k) => present.has(k) && k !== t.key);

  const out: Ticket[] = [];
  const done = new Set<string>();
  const pending = [...base];
  while (pending.length) {
    const next = pending.findIndex((t) => waits(t).every((k) => done.has(k)));
    // A cycle can't arise from the rules above; if one did, keep base order.
    const [t] = pending.splice(next === -1 ? 0 : next, 1);
    out.push(t!);
    done.add(t!.key);
  }
  return out;
}

/** The order dependencies between the queued requests, by ticket key. */
export function ticketDependencies(q: ReviewQueue): Map<string, Dependency> {
  const deps = new Map<string, Dependency>();
  const add = (key: string, pill: string | null, note: DependencyNote | null, blockedBy: string[] = []) => {
    const d = deps.get(key) ?? { pills: [], notes: [], blockedBy: [] };
    if (pill && !d.pills.includes(pill)) d.pills.push(pill);
    if (note) d.notes.push(note);
    d.blockedBy.push(...blockedBy.filter((k) => !d.blockedBy.includes(k)));
    deps.set(key, d);
  };
  const linkKey = new Map(q.links.map((l, i) => [l.uid, { key: ticketKey.link(i), name: l.request.shooterName }]));
  const captainOf = new Map(q.captains.map((c) => [c.team.id, c.captain.uid]));

  q.proposals.forEach((item, i) => {
    const key = ticketKey.proposal(i);
    const p = item.proposal;
    // D1
    const link = linkKey.get(p.captainUid);
    if (link) {
      add(key, 'Review name link first', {
        text: `The captain’s scorecard name link is waiting: “${link.name}”. Review it first, or they are published under their current name.`,
        open: [link.key],
      }, [link.key]);
    }
    // D4
    const captain = captainOf.get(item.teamId);
    if (p.purpose !== 'change' && captain && captain !== p.captainUid) {
      add(key, 'Team already decided', {
        text: 'This team already has a captain, so approving will fail. Reject this proposal with a note.',
        open: [],
      });
    }
    // D5
    if (p.purpose === 'change') {
      q.handoffs.forEach((h, j) => {
        if (h.leagueTeamId !== item.teamId) return;
        const hKey = ticketKey.handoff(j);
        add(key, 'Decide before handoff', {
          text: 'A captain handoff for this team is waiting. Decide this roster change first: after the handoff, it can no longer be approved.',
          open: [hKey],
        });
        add(hKey, 'Roster change first', {
          text: 'The current captain has a roster change waiting for this team. Decide it first: after the handoff, it can no longer be approved.',
          open: [key],
        }, [key]);
      });
    }
  });

  q.registrations.forEach((item, i) => {
    const key = ticketKey.registration(i);
    const r = item.registration;
    // D1
    const link = linkKey.get(r.uid);
    if (link) {
      add(key, 'Review name link first', {
        text: `Scorecard name link waiting: “${link.name}”. Review it first, or they are placed as ${item.selfName}.`,
        open: [link.key],
      }, [link.key]);
    }
    // D2
    const proposals = q.proposals.flatMap((pi, j) => (pi.proposal.year === r.year ? [ticketKey.proposal(j)] : []));
    if (proposals.length) {
      add(key, 'Team proposals first', {
        text: `Team proposals for ${r.year} are waiting. Decide them first: approving a proposal replaces that team’s roster, and a new team can’t be chosen until it is approved.`,
        open: proposals,
      }, proposals);
    }
  });
  return deps;
}

function pills(t: Ticket, dep: Dependency | undefined): string {
  const warn = (dep?.pills ?? []).map((p) => `<span class="req-pill req-pill--order">${escapeHtml(p)}</span>`);
  const flags = t.flags.map((f) => `<span class="req-pill">${escapeHtml(f)}</span>`);
  return warn.length + flags.length ? `<span class="req-row__pills">${[...warn, ...flags].join('')}</span>` : '';
}

function badge(kind: TicketKind): string {
  return `<span class="req-badge req-badge--${kind}">${KIND_LABEL[kind]}</span>`;
}

export function ticketRow(t: Ticket, dep: Dependency | undefined, now: Date, hidden = false): string {
  const iso = t.date ? t.date.toISOString() : '';
  const full = t.date ? t.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  return `
    <li${hidden ? ' hidden' : ''}>
      <button type="button" class="req-row" data-open="${t.key}" aria-haspopup="dialog">
        ${badge(t.kind)}
        <span class="req-row__main">
          <span class="req-row__title">${escapeHtml(t.title)}</span>
          <span class="req-row__sub">${escapeHtml(t.subtitle)}</span>
          ${pills(t, dep)}
        </span>
        <span class="req-row__who">${escapeHtml(t.requester)}</span>
        <span class="req-row__season">${t.season ?? ''}</span>
        <span class="req-row__age">${t.date ? `<time datetime="${iso}" title="${escapeHtml(full)}">${relativeAge(t.date, now)}</time>` : ''}</span>
      </button>
    </li>`;
}

export function filterChips(tickets: readonly Ticket[], active: QueueFilter): string {
  const count = (f: QueueFilter) => (f === 'all' ? tickets.length : tickets.filter((t) => t.kind === f).length);
  const chips = (Object.keys(FILTER_LABEL) as QueueFilter[]).map((f) => `
    <button type="button" class="chip req-chip" data-filter="${f}" aria-pressed="${f === active}">
      ${FILTER_LABEL[f]} <span class="req-chip__count">${count(f)}</span>
    </button>`).join('');
  return `<div class="chip-row req-filters" role="group" aria-label="Filter requests">${chips}</div>`;
}

export function viewToggle(view: QueueView, queueCount: number, captainCount: number): string {
  const btn = (v: QueueView, label: string, n: number) =>
    `<button type="button" data-view="${v}" aria-pressed="${v === view}">${label} <span class="req-chip__count">${n}</span></button>`;
  return `<div class="segmented req-view-toggle" role="group" aria-label="Requests view">
    ${btn('queue', 'Queue', queueCount)}${btn('captains', 'Captains', captainCount)}</div>`;
}

/** The queue list, with tickets outside the filter hidden. */
export function ticketList(tickets: readonly Ticket[], deps: ReadonlyMap<string, Dependency>, filter: QueueFilter, now: Date): string {
  const shown = tickets.filter((t) => filter === 'all' || t.kind === filter).length;
  const rows = tickets.map((t) => ticketRow(t, deps.get(t.key), now, filter !== 'all' && t.kind !== filter)).join('');
  return `
    ${tickets.length ? `<ul class="req-list" aria-label="Requests">${rows}</ul>` : ''}
    ${shown ? '' : `<p class="req-muted req-empty">${EMPTY_TEXT[filter]}</p>`}`;
}

/** Dialog content: header, body (order notes first), and footer actions. */
export function ticketDialogContent(t: Ticket, dep: Dependency | undefined, ticketOf: (key: string) => Ticket | undefined): string {
  const notes = (dep?.notes ?? []).map((n) => {
    const links = n.open.flatMap((k) => {
      const target = ticketOf(k);
      return target
        ? [`<button type="button" class="req-open" data-open="${k}">Open ${KIND_NOUN[target.kind]}: ${escapeHtml(target.title)}, from ${escapeHtml(target.requester)}</button>`]
        : [];
    }).join('');
    return `<div class="req-warning req-order" role="note">${escapeHtml(n.text)}${links ? `<span class="req-order__links">${links}</span>` : ''}</div>`;
  }).join('');
  return `
    <div class="req-dialog__card" data-card="${t.key}">
      <header class="req-dialog__header">
        <div class="req-dialog__heading">
          ${badge(t.kind)}
          <h2 id="req-dialog-title" class="req-dialog__title">${escapeHtml(t.title)}</h2>
          <p class="req-dialog__meta">${escapeHtml(t.meta)}</p>
        </div>
        <button type="button" class="admin-icon-btn req-dialog__close" data-close aria-label="Close">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </header>
      <div class="req-dialog__body">${notes}${t.body}</div>
      <footer class="req-dialog__footer">${t.actions}</footer>
    </div>`;
}
