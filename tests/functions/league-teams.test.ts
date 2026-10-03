/**
 * Tests for the league team backfill (spec 009 AC-1): the pure planner and
 * the emulator round trip (idempotent, seasons/** untouched).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { FieldValue } from 'firebase-admin/firestore';
// @ts-expect-error -- plain JS module without type declarations
import { parseMerges, planLeagueTeams, syncLeagueTeams } from '../../scripts/lib/league-teams.js';
import { adminDb, clearFirestore } from './_helpers.js';

describe('planLeagueTeams', () => {
  it('groups by id, sorts seasons, and names from the latest season', () => {
    const plan = planLeagueTeams([
      { year: 2025, id: 'eagles', name: 'Eagles II' },
      { year: 2023, id: 'eagles', name: 'Eagles' },
      { year: 2024, id: 'hawks', name: 'Hawks' },
    ], new Map());
    expect(plan).toEqual([
      { id: 'eagles', create: true, data: { name: 'Eagles II', seasons: [2023, 2025], captainUid: null } },
      { id: 'hawks', create: true, data: { name: 'Hawks', seasons: [2024], captainUid: null } },
    ]);
  });

  it('skips unchanged docs and updates new seasons without touching captainUid', () => {
    const existing = new Map([
      ['eagles', { name: 'Eagles', seasons: [2024], captainUid: 'uCap' }],
      ['hawks', { name: 'Hawks', seasons: [2024], captainUid: null }],
    ]);
    const plan = planLeagueTeams([
      { year: 2024, id: 'eagles', name: 'Eagles' },
      { year: 2025, id: 'eagles', name: 'Eagles' },
      { year: 2024, id: 'hawks', name: 'Hawks' },
    ], existing);
    expect(plan).toEqual([{ id: 'eagles', create: false, data: { name: 'Eagles', seasons: [2024, 2025] } }]);
  });
});

describe('merges (renamed teams)', () => {
  const rename = [
    { year: 2024, id: 'smoking-guns', name: 'Smoking Guns' },
    { year: 2025, id: 'smoking-guns', name: 'Smoking Guns' },
    { year: 2026, id: 'the-smoking-guns', name: 'The Smoking Guns' },
  ];

  it('folds the old id into the current one and records it', () => {
    const plan = planLeagueTeams(rename, new Map(), new Map([['smoking-guns', 'the-smoking-guns']]));
    expect(plan).toEqual([{
      id: 'the-smoking-guns', create: true,
      data: { name: 'The Smoking Guns', seasons: [2024, 2025, 2026], captainUid: null, formerIds: ['smoking-guns'] },
    }]);
  });

  it('is idempotent once applied', () => {
    const existing = new Map([['the-smoking-guns',
      { name: 'The Smoking Guns', seasons: [2024, 2025, 2026], captainUid: null, formerIds: ['smoking-guns'] }]]);
    expect(planLeagueTeams(rename, existing, new Map([['smoking-guns', 'the-smoking-guns']]))).toEqual([]);
  });

  it('rejects unknown ids, self-merges, chains, and malformed pairs', () => {
    expect(() => planLeagueTeams(rename, new Map(), new Map([['nope', 'the-smoking-guns']]))).toThrow(/no season has team "nope"/);
    expect(() => parseMerges(['--merge', 'a=a'])).toThrow(/itself/);
    expect(() => parseMerges(['--merge', 'a=b', '--merge', 'b=c'])).toThrow(/itself merged/);
    expect(() => parseMerges(['--merge', 'a'])).toThrow(/old=new/);
    expect([...parseMerges(['--dry-run', '--merge', 'a=b'])]).toEqual([['a', 'b']]);
  });
});

describe('syncLeagueTeams', () => {
  beforeEach(async () => { await clearFirestore(); });

  it('creates league teams, is idempotent, and never writes seasons/**', async () => {
    const db = adminDb();
    await db.doc('seasons/2024').set({ year: 2024 });
    await db.doc('seasons/2025').set({ year: 2025 });
    await db.doc('seasons/2024/teams/eagles').set({ name: 'Eagles' });
    await db.doc('seasons/2025/teams/eagles').set({ name: 'Eagles' });
    await db.doc('seasons/2025/teams/hawks').set({ name: 'Hawks' });
    const before = await db.doc('seasons/2025/teams/eagles').get();

    const dry = await syncLeagueTeams(db, { dryRun: true, FieldValue });
    expect(dry.plan).toHaveLength(2);
    expect((await db.collection('leagueTeams').get()).size).toBe(0);

    await syncLeagueTeams(db, { FieldValue });
    const eagles = (await db.doc('leagueTeams/eagles').get()).data();
    expect(eagles).toMatchObject({ name: 'Eagles', seasons: [2024, 2025], captainUid: null });

    await db.doc('leagueTeams/eagles').update({ captainUid: 'uCap' });
    const again = await syncLeagueTeams(db, { FieldValue });
    expect(again.plan).toEqual([]);
    expect((await db.doc('leagueTeams/eagles').get()).data()?.['captainUid']).toBe('uCap');

    const after = await db.doc('seasons/2025/teams/eagles').get();
    expect(after.updateTime?.isEqual(before.updateTime!)).toBe(true);
  });
});
