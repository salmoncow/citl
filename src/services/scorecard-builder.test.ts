/**
 * @file scorecard-builder.test.ts
 * Unit tests for toAwardShooterInputs — the pure adapter from rendered
 * scorecard blocks to the flat inputs computeSeasonAwards consumes
 * (spec 004 DD-3). Pure function — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import type { ScorecardRowShooter, ScorecardTeamBlock } from '@/types/scorecard';
import { toAwardShooterInputs } from './scorecard-builder';

const makeRow = (overrides: Partial<ScorecardRowShooter> = {}): ScorecardRowShooter => ({
  name: 'Alice',
  rookie: false,
  isDummy: false,
  w0Display: 42.5,
  scores: new Array<number | null>(15).fill(null),
  weeksShot: null,
  finalAvg: 42.5,
  ...overrides,
});

const makeBlock = (teamName: string, shooters: ScorecardRowShooter[]): ScorecardTeamBlock => ({
  teamName,
  shooters,
  targets: new Array<number | null>(15).fill(null),
  rankPoints: new Array<number | null>(15).fill(null),
  bonusPoints: new Array<number | null>(15).fill(null),
});

describe('toAwardShooterInputs', () => {
  it('maps row fields and attaches the block teamName', () => {
    const scores = new Array<number | null>(15).fill(null);
    scores[0] = 44;
    const inputs = toAwardShooterInputs([
      makeBlock('Sights Impaired', [makeRow({ name: 'Randy', rookie: true, w0Display: 38.25, scores })]),
    ]);
    expect(inputs).toEqual([
      {
        name: 'Randy',
        teamName: 'Sights Impaired',
        isDummy: false,
        rookie: true,
        startingAvg: 38.25,
        scores,
      },
    ]);
  });

  it("skips rows whose w0Display is '-' (dummy/padding rows only)", () => {
    const inputs = toAwardShooterInputs([
      makeBlock('Team A', [
        makeRow({ name: 'Real', w0Display: 40 }),
        makeRow({ name: 'A DUMMY2', isDummy: true, w0Display: '-' }),
      ]),
    ]);
    expect(inputs.map((i) => i.name)).toEqual(['Real']);
  });

  it('passes numeric-W0 dummies through with isDummy intact (engine stays the exclusion authority)', () => {
    const inputs = toAwardShooterInputs([
      makeBlock('Team A', [makeRow({ name: 'A DUMMY1', isDummy: true, w0Display: 41.3 })]),
    ]);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.isDummy).toBe(true);
    expect(inputs[0]!.startingAvg).toBe(41.3);
  });

  it('flattens multiple blocks in order and ignores display finalAvg/weeksShot', () => {
    const inputs = toAwardShooterInputs([
      makeBlock('Team A', [makeRow({ name: 'A1', finalAvg: '—' as unknown as string, weeksShot: 3 })]),
      makeBlock('Team B', [makeRow({ name: 'B1' }), makeRow({ name: 'B2' })]),
    ]);
    expect(inputs.map((i) => `${i.teamName}/${i.name}`)).toEqual(['Team A/A1', 'Team B/B1', 'Team B/B2']);
    expect(inputs[0]).not.toHaveProperty('finalAvg');
    expect(inputs[0]).not.toHaveProperty('weeksShot');
  });

  it('returns [] for empty blocks', () => {
    expect(toAwardShooterInputs([])).toEqual([]);
    expect(toAwardShooterInputs([makeBlock('Empty', [])])).toEqual([]);
  });
});
