/**
 * Pure tests for functions/src/lib/publish.ts (spec 010 AC-8, AC-10, AC-14).
 */

import { describe, expect, it } from 'vitest';
import {
  addToRoster,
  droppedNames,
  replaceRoster,
  rosterFromTeam,
  toTeamShooter,
  type TeamShooter,
} from '../../functions/src/lib/publish.js';

function shooter(name: string, extra: Partial<TeamShooter> = {}): TeamShooter {
  return { id: '', name, rookie: false, startingAvg: 40, finalAvg: null, weeksShot: null, scores: [], ...extra };
}

const set = (name: string, startingAvg = 35, rookie = true) => ({ name, startingAvg, rookie });
const none = new Set<string>();

describe('replaceRoster', () => {
  const current = [shooter('Al One', { startingAvg: 44, scores: [45] }), shooter('Bo Two'), shooter('Cy Three')];

  it('keeps stored shooters by name, adds new ones with their settings, in roster order', () => {
    const next = replaceRoster(current, ['Pat Captain', 'al one', 'Cy Three'], [set('Pat Captain', 38, false)], none);
    expect(next.map((s) => s.name)).toEqual(['Pat Captain', 'Al One', 'Cy Three']);
    expect(next[0]).toEqual(shooter('Pat Captain', { startingAvg: 38 }));
    expect(next[1]).toBe(current[0]);
  });

  it('refuses a new shooter with no setting or an out-of-range average', () => {
    expect(() => replaceRoster(current, ['New Guy'], [], none)).toThrow(expect.objectContaining({ reason: 'missing-average' }));
    expect(() => replaceRoster(current, ['New Guy'], [set('New Guy', 51)], none)).toThrow(expect.objectContaining({ reason: 'missing-average' }));
    expect(() => replaceRoster(current, ['New Guy'], [set('New Guy', -1)], none)).toThrow(expect.objectContaining({ reason: 'missing-average' }));
    expect(() => replaceRoster(current, ['New Guy'], [set('New Guy', Number.NaN)], none)).toThrow(expect.objectContaining({ reason: 'missing-average' }));
  });

  it('drops shooters without scores and refuses to drop one with scores', () => {
    expect(replaceRoster(current, ['Al One'], [], none).map((s) => s.name)).toEqual(['Al One']);
    expect(() => replaceRoster(current, ['Al One'], [], new Set(['bo two'])))
      .toThrow(expect.objectContaining({ reason: 'shooter-has-scores' }));
  });

  it('refuses more than 15 shooters and duplicates', () => {
    const sixteen = Array.from({ length: 16 }, (_, i) => `Shooter ${i}`);
    expect(() => replaceRoster([], sixteen, sixteen.map((n) => set(n)), none))
      .toThrow(expect.objectContaining({ reason: 'roster-too-long' }));
    expect(() => replaceRoster([], ['Ed Five', 'ed five'], [set('Ed Five')], none))
      .toThrow(expect.objectContaining({ reason: 'duplicate-name' }));
  });

  it('droppedNames lists the team doc names left off', () => {
    expect(droppedNames(current, ['AL ONE'])).toEqual(['Bo Two', 'Cy Three']);
  });
});

describe('addToRoster', () => {
  it('appends new shooters with settings', () => {
    const next = addToRoster([shooter('Al One')], ['Pat New', 'Sam D.'], [set('Pat New', 30, true), set('sam d.', 20, true)]);
    expect(next.map((s) => [s.name, s.startingAvg])).toEqual([['Al One', 40], ['Pat New', 30], ['Sam D.', 20]]);
  });

  it('refuses a name already on the team and a 16th shooter', () => {
    expect(() => addToRoster([shooter('Al One')], ['al one'], [set('al one')]))
      .toThrow(expect.objectContaining({ reason: 'duplicate-name' }));
    const fifteen = Array.from({ length: 15 }, (_, i) => shooter(`S ${i}`));
    expect(() => addToRoster(fifteen, ['Pat New'], [set('Pat New')]))
      .toThrow(expect.objectContaining({ reason: 'roster-too-long' }));
  });
});

describe('rosterFromTeam', () => {
  it('maps the captain to self, dependents by "First L.", and keeps minor guardians from the previous roster', () => {
    const team = [shooter('Pat Captain', { rookie: true }), shooter('Sam D.'), shooter('Kim L.'), shooter('Al One')];
    const roster = rosterFromTeam(team, {
      selfName: 'Pat Captain',
      dependents: new Map([['d1', { firstName: 'Sam', lastName: 'doe' }]]),
      previous: [{ kind: 'named', name: 'Kim L.', rookie: false, minor: true, guardianName: 'Al One' }],
    });
    expect(roster).toEqual([
      { kind: 'self', name: 'Pat Captain', rookie: true, minor: false },
      { kind: 'dependent', name: 'Sam D.', rookie: false, minor: true, dependentId: 'd1' },
      { kind: 'named', name: 'Kim L.', rookie: false, minor: true, guardianName: 'Al One' },
      { kind: 'named', name: 'Al One', rookie: false, minor: false },
    ]);
  });

  it('treats a captain no longer on the team as absent', () => {
    const roster = rosterFromTeam([shooter('Al One')], { selfName: 'Pat Captain', dependents: new Map(), previous: [] });
    expect(roster.map((e) => e.kind)).toEqual(['named']);
  });
});

describe('toTeamShooter', () => {
  it('fills legacy gaps and rejects nameless entries', () => {
    expect(toTeamShooter({ name: 'Al One' })).toEqual(shooter('Al One', { startingAvg: 35 }));
    expect(toTeamShooter({ name: ' ' })).toBeNull();
    expect(toTeamShooter(null)).toBeNull();
  });
});
