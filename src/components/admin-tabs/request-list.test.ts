import { describe, expect, it } from 'vitest';
import type { ReviewQueue } from '@/services/league-review-service';
import type { Ticket } from './request-cards';
import { filterChips, relativeAge, sortTickets, ticketDependencies, ticketList, ticketRow, type Dependency } from './request-list';

const NOW = new Date('2026-10-10T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const ticket = (key: string, date: Date | null, over: Partial<Ticket> = {}): Ticket => ({
  key, kind: 'proposal', title: key, subtitle: '', requester: 'Pat', season: 2026, date,
  flags: [], meta: '', body: '', actions: '', ...over,
});

const member = (uid: string) => ({ uid, name: `Name ${uid}`, email: null, active: true });
const ts = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) });

function queue(over: Partial<ReviewQueue>): ReviewQueue {
  return { proposals: [], registrations: [], links: [], handoffs: [], captains: [], ...over } as ReviewQueue;
}
const proposal = (captainUid: string, teamId: string, purpose: 'initial' | 'change' = 'initial', year = 2026) => ({
  proposal: { id: `${year}_${captainUid}`, captainUid, year, purpose, teamSource: 'returning', leagueTeamId: teamId, teamName: teamId, shooters: [], submittedAt: ts(1) },
  member: member(captainUid),
  teamId,
  competing: 0,
});
const registration = (uid: string, year = 2026) => ({
  registration: { id: `${year}_${uid}`, uid, year, dependentIds: [], preferredLeagueTeamId: null, note: null, status: 'submitted' },
  member: member(uid), selfName: `Name ${uid}`, dependents: [], pendingLinkName: null,
});
const link = (uid: string, shooterName: string) => ({ uid, request: { shooterName, status: 'submitted' }, member: member(uid) });

describe('relativeAge', () => {
  it('says Today under a day, days under 60, then a date', () => {
    expect(relativeAge(null, NOW)).toBe('');
    expect(relativeAge(new Date(NOW.getTime() - 3_600_000), NOW)).toBe('Today');
    expect(relativeAge(new Date(NOW.getTime() + 3_600_000), NOW)).toBe('Today');
    expect(relativeAge(daysAgo(1), NOW)).toBe('1d');
    expect(relativeAge(daysAgo(59), NOW)).toBe('59d');
    expect(relativeAge(daysAgo(60), NOW)).not.toMatch(/d$/);
  });
});

describe('sortTickets', () => {
  it('puts the oldest first and undated last, keeping ties stable', () => {
    const out = sortTickets([ticket('a', null), ticket('b', daysAgo(1)), ticket('c', daysAgo(5)), ticket('d', daysAgo(1))], new Map());
    expect(out.map((t) => t.key)).toEqual(['c', 'b', 'd', 'a']);
  });

  it('moves a ticket directly after the tickets it waits on', () => {
    const deps = new Map<string, Dependency>([['r0', { pills: [], notes: [], blockedBy: ['p0', 'l0'] }]]);
    const out = sortTickets([ticket('r0', daysAgo(9)), ticket('p0', daysAgo(3)), ticket('l0', daysAgo(5)), ticket('h0', daysAgo(1))], deps);
    expect(out.map((t) => t.key)).toEqual(['l0', 'p0', 'r0', 'h0']);
  });

  it('ignores blockers that are not in the list', () => {
    const deps = new Map<string, Dependency>([['r0', { pills: [], notes: [], blockedBy: ['gone'] }]]);
    expect(sortTickets([ticket('p0', daysAgo(1)), ticket('r0', daysAgo(2))], deps).map((t) => t.key)).toEqual(['r0', 'p0']);
  });
});

describe('ticketDependencies', () => {
  it('D1: a pending name link goes before the member’s join request and proposal', () => {
    const deps = ticketDependencies(queue({
      proposals: [proposal('u1', 'eagles')] as never,
      registrations: [registration('u1', 2025)] as never,
      links: [link('u1', 'Pat Smith')] as never,
    }));
    expect(deps.get('p0')?.blockedBy).toEqual(['l0']);
    expect(deps.get('r0')?.blockedBy).toEqual(['l0']);
    expect(deps.get('r0')?.pills).toContain('Review name link first');
    expect(deps.get('r0')?.notes[0]?.text).toContain('placed as Name u1');
    expect(deps.has('l0')).toBe(false);
  });

  it('D2: proposals for a season go before join requests for that season only', () => {
    const deps = ticketDependencies(queue({
      proposals: [proposal('u1', 'eagles'), proposal('u2', 'hawks', 'initial', 2025)] as never,
      registrations: [registration('u3'), registration('u4', 2027)] as never,
    }));
    expect(deps.get('r0')?.blockedBy).toEqual(['p0']);
    expect(deps.get('r0')?.notes[0]?.open).toEqual(['p0']);
    expect(deps.has('r1')).toBe(false);
  });

  it('D4: a proposal for a team that already has another captain must be rejected', () => {
    const deps = ticketDependencies(queue({
      proposals: [proposal('u1', 'eagles'), proposal('u2', 'eagles'), proposal('u3', 'eagles', 'change')] as never,
      captains: [{ team: { id: 'eagles', name: 'Eagles', captainUid: 'u2', seasons: [] }, captain: member('u2') }] as never,
    }));
    expect(deps.get('p0')?.pills).toEqual(['Team already decided']);
    expect(deps.has('p1')).toBe(false);
    expect(deps.has('p2')).toBe(false);
  });

  it('D5: a roster change goes before a handoff on the same team', () => {
    const deps = ticketDependencies(queue({
      proposals: [proposal('u1', 'eagles', 'change'), proposal('u2', 'hawks', 'change')] as never,
      handoffs: [{ leagueTeamId: 'eagles', teamName: 'Eagles', fromUid: 'u1', fromName: 'A', toUid: 'u9', toName: 'B', status: 'accepted', reviewNote: null }] as never,
    }));
    expect(deps.get('h0')?.blockedBy).toEqual(['p0']);
    expect(deps.get('h0')?.pills).toEqual(['Roster change first']);
    expect(deps.get('p0')?.pills).toEqual(['Decide before handoff']);
    expect(deps.get('p0')?.blockedBy).toEqual([]);
    expect(deps.has('p1')).toBe(false);
  });
});

describe('ticketRow', () => {
  it('escapes user text and shows order pills before flags', () => {
    const html = ticketRow(
      ticket('p0', daysAgo(3), { title: '<b>Eagles</b>', requester: '"Pat"', flags: ['Competing'] }),
      { pills: ['Review name link first'], notes: [], blockedBy: [] },
      NOW,
    );
    expect(html).toContain('&lt;b&gt;Eagles&lt;/b&gt;');
    expect(html).toContain('&quot;Pat&quot;');
    expect(html).not.toContain('<b>');
    expect(html.indexOf('Review name link first')).toBeLessThan(html.indexOf('Competing'));
    expect(html).toContain('data-open="p0"');
    expect(html).toContain('>3d</time>');
  });
});

describe('filters', () => {
  const tickets = [ticket('p0', null), ticket('r0', null, { kind: 'registration' }), ticket('r1', null, { kind: 'registration' })];

  it('counts each kind and presses the active chip', () => {
    const html = filterChips(tickets, 'registration');
    expect(html).toMatch(/data-filter="all" aria-pressed="false">\s*All <span class="req-chip__count">3</);
    expect(html).toMatch(/data-filter="registration" aria-pressed="true">\s*Join requests <span class="req-chip__count">2</);
    expect(html).toMatch(/data-filter="handoff" aria-pressed="false">\s*Captain handoffs <span class="req-chip__count">0</);
  });

  it('hides rows outside the filter and shows the empty text when none match', () => {
    const html = ticketList(tickets, new Map(), 'registration', NOW);
    expect(html.match(/<li hidden>/g)).toHaveLength(1);
    expect(ticketList(tickets, new Map(), 'handoff', NOW)).toContain('No handoffs waiting.');
  });
});
