import { describe, it, expect } from 'vitest';
import { previewTeamNight } from './score-entry-preview';
import type { SeasonEntry, Team } from '@/types/score';

function team(name: string, shooters: [string, number, boolean][]): Team {
  return {
    id: name.toLowerCase(),
    name,
    captain: shooters[0]![0],
    shooters: shooters.map(([n, avg, rookie]) => ({
      id: n, name: n, rookie, startingAvg: avg, finalAvg: null, weeksShot: null,
      scores: Array.from({ length: 15 }, () => null),
    })),
    totals: { targets: [], rankPoints: [], bonusPoints: [] },
  };
}

function entry(teamName: string, weekNumber: number, scores: [string, number, number][]): SeasonEntry {
  return {
    year: 2026, weekNumber, teamId: teamName.toLowerCase(), teamName, savedAt: '',
    shooters: scores.map(([name, score1, score2]) => ({ name, score1, score2, total: score1 + score2 })),
  };
}

const FALCONS = team('Falcons', [
  ['Mike', 44.6, false], ['Carl', 47.1, false], ['Steve', 43.2, false], ['Doug', 41, false], ['Ben', 34, true],
]);

describe('previewTeamNight', () => {
  const draft = entry('Falcons', 1, [['Mike', 23, 22], ['Carl', 24, 24], ['Steve', 22, 21], ['Doug', 20, 22], ['Ben', 19, 20]]);

  it('totals the draft and compares with the going-in sum (week 1 = starting averages)', () => {
    const p = previewTeamNight({ year: 2026, weekNumber: 1, teams: [FALCONS], entries: [], draft })!;
    expect(p.teamTotal).toBe(217);
    expect(p.goingInSum).toBeCloseTo(209.9, 5);
    expect(p.targetBonus).toBe(5);
    expect(p.yardage?.yards).toBe(25);
    expect(p.goingInByName.get('carl')).toBeCloseTo(47.1, 5);
  });

  it('explains the rookie bonus per rookie who shot', () => {
    const p = previewTeamNight({ year: 2026, weekNumber: 1, teams: [FALCONS], entries: [], draft })!;
    expect(p.rookieBonus).toBe(1);
    expect(p.rookieNotes).toEqual([{ name: 'Ben', goingIn: 34, qualifies: true }]);
  });

  it('replaces a saved entry for the same team and week with the draft', () => {
    const saved = entry('Falcons', 1, [['Mike', 10, 10]]);
    const p = previewTeamNight({ year: 2026, weekNumber: 1, teams: [FALCONS], entries: [saved], draft })!;
    expect(p.teamTotal).toBe(217);
  });

  it('closes the rookie window after week 10', () => {
    const late = { ...draft, weekNumber: 11 };
    const p = previewTeamNight({ year: 2026, weekNumber: 11, teams: [FALCONS], entries: [], draft: late })!;
    expect(p.rookieWindowClosed).toBe(true);
    expect(p.rookieBonus).toBe(0);
    expect(p.rookieNotes[0]!.qualifies).toBe(false);
  });

  it('returns null for a team that is not on the roster list', () => {
    const other = entry('Nobody', 1, [['X', 20, 20]]);
    expect(previewTeamNight({ year: 2026, weekNumber: 1, teams: [FALCONS], entries: [], draft: other })).toBeNull();
  });
});
