/**
 * Message content for each kind of email (spec 011 AC-12 – AC-17, AC-19).
 * Pure: every builder takes plain values and returns MailContent; the
 * sender adds the footer. Builders never receive rosters or minors' names
 * (AC-18).
 */

import type { MailContent } from './types.js';

// ── Topic emails ────────────────────────────────────────────────────────────

export function newsContent(title: string, body: string): MailContent {
  return {
    subject: title,
    paragraphs: body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    link: { label: 'Read it on citl.club', path: '/' },
  };
}

export interface WeekTeam {
  teamName: string;
  targets: number;
}

export function scoresContent(year: number, week: number, teams: WeekTeam[]): MailContent {
  const top = [...teams].sort((a, b) => b.targets - a.targets).slice(0, 3);
  const lines = top.map((t, i) => `${i + 1}. ${t.teamName}: ${t.targets}`);
  return {
    subject: `Week ${week} results are posted`,
    paragraphs: [
      `Results for week ${week} of the ${year} season are on citl.club.`,
      ...(lines.length > 0 ? [`Top teams this week:\n${lines.join('\n')}`] : []),
    ],
    link: { label: 'See standings and scorecards', path: '/#/standings' },
  };
}

export type Overrides = Partial<Record<string, string | null>>;

/** "2026-06-10" → "Tue, Jun 10"; anything else is shown as given. */
export function formatShootDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export interface ScheduleChange {
  week: number;
  /** ISO date, null for cancelled, undefined when the override was removed. */
  value: string | null | undefined;
}

/** Weeks after currentWeek whose override changed (AC-14), in week order. */
export function scheduleChanges(before: Overrides, after: Overrides, currentWeek: number): ScheduleChange[] {
  const weeks = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: ScheduleChange[] = [];
  for (const key of weeks) {
    const week = Number(key);
    if (!Number.isInteger(week) || week <= currentWeek) continue;
    const was = before[key];
    const now = after[key];
    if (was === now) continue;
    changes.push({ week, value: now });
  }
  return changes.sort((a, b) => a.week - b.week);
}

export function scheduleLine(change: ScheduleChange): string {
  if (change.value === null) return `Week ${change.week} is cancelled.`;
  if (change.value === undefined) return `Week ${change.week} is back on its regular date.`;
  return `Week ${change.week} moves to ${formatShootDate(change.value)}.`;
}

export function scheduleContent(year: number, changes: ScheduleChange[]): MailContent {
  return {
    subject: changes.length === 1 ? `Schedule change: week ${changes[0]?.week}` : 'Schedule changes',
    paragraphs: [`The ${year} shoot schedule changed:`, changes.map(scheduleLine).join('\n')],
    link: { label: 'See the schedule', path: '/' },
  };
}

// ── Status emails (AC-16, AC-17) ───────────────────────────────────────────

const withNote = (note: string | null | undefined): string[] =>
  note && note.trim() ? [`Coordinator's note: ${note.trim()}`] : [];

const ACCOUNT_LINK = { label: 'Open your account', path: '/#/account' };

export type ProposalOutcome = 'approved' | 'rejected' | 'changes-requested' | 'change-approved' | 'change-rejected';

export function proposalContent(teamName: string, year: number, outcome: ProposalOutcome, note?: string | null): MailContent {
  const lead: Record<ProposalOutcome, [string, string]> = {
    'approved': [`${teamName} is approved for ${year}`, `The coordinator approved your team proposal for ${teamName}. The roster is now on citl.club.`],
    'rejected': [`${teamName} was not approved`, `The coordinator did not approve your team proposal for ${teamName} for ${year}.`],
    'changes-requested': [`Changes requested for ${teamName}`, `The coordinator asked for changes to your team proposal for ${teamName}. Edit it on your account page and submit it again.`],
    'change-approved': [`${teamName} roster change approved`, `The coordinator approved your roster change for ${teamName}. The updated roster is now on citl.club.`],
    'change-rejected': [`${teamName} roster change not approved`, `The coordinator did not approve your roster change for ${teamName}. The published roster stays as it was.`],
  };
  const [subject, first] = lead[outcome];
  return { subject, paragraphs: [first, ...withNote(note)], link: ACCOUNT_LINK };
}

export function registrationContent(year: number, outcome: 'placed' | 'declined', teamName?: string, note?: string | null): MailContent {
  return outcome === 'placed'
    ? {
        subject: `You're on ${teamName ?? 'a team'} for ${year}`,
        paragraphs: [`The coordinator placed you on ${teamName ?? 'a team'} for the ${year} season.`, ...withNote(note)],
        link: ACCOUNT_LINK,
      }
    : {
        subject: `Your ${year} join request`,
        paragraphs: [`The coordinator declined your request to join a team for ${year}.`, ...withNote(note)],
        link: ACCOUNT_LINK,
      };
}

export function linkContent(outcome: 'approved' | 'declined', shooterName: string, note?: string | null): MailContent {
  return outcome === 'approved'
    ? {
        subject: 'Your scorecard name is linked',
        paragraphs: [`The coordinator linked your account to the scorecard name ${shooterName}.`, ...withNote(note)],
        link: ACCOUNT_LINK,
      }
    : {
        subject: 'Your scorecard name request',
        paragraphs: [`The coordinator declined your request to link the scorecard name ${shooterName}.`, ...withNote(note)],
        link: ACCOUNT_LINK,
      };
}

export type HandoffEvent =
  | 'nominated' | 'cancelled' | 'accepted' | 'declined'
  | 'approved-new' | 'approved-old' | 'rejected-new' | 'rejected-old' | 'removed';

/** One captain-handoff email; `other` is the other member's profile name. */
export function handoffContent(event: HandoffEvent, teamName: string, other: string, note?: string | null): MailContent {
  const text: Record<HandoffEvent, [string, string]> = {
    'nominated': [`You're nominated as captain of ${teamName}`, `${other} nominated you to take over as captain of ${teamName}. Accept or decline on your account page; the coordinator then approves the handoff.`],
    'cancelled': [`Captain nomination for ${teamName} cancelled`, `${other} cancelled your nomination as captain of ${teamName}.`],
    'accepted': [`${other} accepted the ${teamName} captaincy`, `${other} accepted your nomination as captain of ${teamName}. The coordinator decides the handoff next.`],
    'declined': [`${other} declined the ${teamName} captaincy`, `${other} declined your nomination as captain of ${teamName}. You can nominate someone else on your account page.`],
    'approved-new': [`You're now captain of ${teamName}`, `The coordinator approved the handoff. You are now captain of ${teamName}.`],
    'approved-old': [`${teamName} captaincy handed off`, `The coordinator approved the handoff. ${other} is now captain of ${teamName}.`],
    'rejected-new': [`${teamName} captain handoff not approved`, `The coordinator did not approve the handoff of ${teamName} to you.`],
    'rejected-old': [`${teamName} captain handoff not approved`, `The coordinator did not approve the handoff of ${teamName} to ${other}. You remain captain.`],
    'removed': [`You're no longer captain of ${teamName}`, `The coordinator removed you as captain of ${teamName}.`],
  };
  const [subject, first] = text[event];
  return { subject, paragraphs: [first, ...withNote(note)], link: ACCOUNT_LINK };
}

// ── Coordinator digest (AC-19) ─────────────────────────────────────────────

export interface DigestCounts {
  proposals: number;
  registrations: number;
  links: number;
  captains: number;
}

export function digestContent(counts: DigestCounts): MailContent {
  const rows: Array<[number, string]> = [
    [counts.proposals, 'team proposal'],
    [counts.registrations, 'join request'],
    [counts.links, 'scorecard-name link'],
    [counts.captains, 'captain handoff'],
  ];
  const lines = rows.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}${n === 1 ? '' : 's'}`);
  const total = rows.reduce((sum, [n]) => sum + n, 0);
  return {
    subject: `${total} new league request${total === 1 ? '' : 's'} to review`,
    paragraphs: ['New since the last summary:', lines.join('\n')],
    link: { label: 'Open the Requests tab', path: '/#/admin' },
  };
}
