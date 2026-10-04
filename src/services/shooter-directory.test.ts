import { describe, expect, it } from 'vitest';
import { buildShooterDirectory, closeMatches, findExact, loadShooterDirectory, searchDirectory } from './shooter-directory';
import type { Team } from '@/types/score';

function team(name: string, shooters: string[]): Team {
  return {
    id: name.toLowerCase(),
    name,
    captain: '',
    shooters: shooters.map((n, i) => ({ id: String(i), name: n, rookie: false, startingAvg: 35, finalAvg: null, weeksShot: null, scores: [] })),
    totals: { targets: [], rankPoints: [], bonusPoints: [] },
  } as unknown as Team;
}

describe('buildShooterDirectory', () => {
  it('merges names across seasons and keeps the latest spelling', () => {
    const dir = buildShooterDirectory([
      { year: 2024, teams: [team('Eagles', ['Aaron klein', 'Pete Sandoval'])] },
      { year: 2025, teams: [team('Hawks', ['Aaron Klein '])] },
    ]);
    expect(dir).toEqual([
      { name: 'Aaron Klein', key: 'aaron klein', seasons: [2024, 2025], teams: ['Eagles', 'Hawks'] },
      { name: 'Pete Sandoval', key: 'pete sandoval', seasons: [2024], teams: ['Eagles'] },
    ]);
  });
});

describe('searchDirectory', () => {
  const dir = buildShooterDirectory([{ year: 2025, teams: [team('Eagles', ['Aaron Klein', 'Klein Aaronson', 'Pete Sandoval'])] }]);

  it('matches every word in any order, exact first', () => {
    expect(searchDirectory(dir, 'klein').map((e) => e.name)).toEqual(['Aaron Klein', 'Klein Aaronson']);
    expect(searchDirectory(dir, 'aaron klein')[0]?.name).toBe('Aaron Klein');
    expect(searchDirectory(dir, '  ')).toEqual([]);
  });
});

describe('closeMatches / findExact', () => {
  const dir = buildShooterDirectory([{ year: 2025, teams: [team('Eagles', ['John Smith', 'Jonathan Smith', 'Jon Smithers', 'Pete Sandoval'])] }]);

  it('puts the exact name first, then word matches, then same surname', () => {
    expect(closeMatches(dir, 'jonathan  smith').map((e) => e.name)).toEqual(['Jonathan Smith', 'John Smith']);
    expect(closeMatches(dir, 'Jon Smith').map((e) => e.name)).toEqual(['Jon Smithers', 'Jonathan Smith', 'John Smith']);
    expect(closeMatches(dir, 'Zed Nobody')).toEqual([]);
  });

  it('finds only an exact (normalized) name', () => {
    expect(findExact(dir, ' john   SMITH ')?.name).toBe('John Smith');
    expect(findExact(dir, 'Jon Smith')).toBeNull();
  });
});

describe('loadShooterDirectory', () => {
  it('reads every season and propagates a failure', async () => {
    const ok = await loadShooterDirectory({
      getAllSeasons: async () => ({ success: true, data: [{ year: 2025 }] as never }),
      getTeams: async () => ({ success: true, data: [team('Eagles', ['Al One'])] }),
    });
    expect(ok.success && ok.data.map((e) => e.name)).toEqual(['Al One']);
    const bad = await loadShooterDirectory({
      getAllSeasons: async () => ({ success: true, data: [{ year: 2025 }] as never }),
      getTeams: async () => ({ success: false, error: 'x', code: 'unavailable' }),
    });
    expect(bad.success).toBe(false);
  });
});
