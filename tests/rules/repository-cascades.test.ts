/**
 * Emulator tests for ScoreRepository's multi-document cascades (F-29):
 * cascadeTeamRename and deleteTeam — the highest-risk batch logic in the
 * repository, previously covered by zero tests.
 *
 * Reuses the rules-test harness (same emulator, same CI job). The repository
 * runs through an admin-role context, so these tests also prove the batches
 * are permitted by the live security rules, not just by the Admin SDK.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { asRole, seed, setupTestEnv } from './_helpers.js';
import { ScoreRepository } from '../../src/repositories/score-repository';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupTestEnv(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seedSeasonData();
});
afterAll(async () => { await env.cleanup(); });

const YEAR = 2026;

function adminRepo(): ScoreRepository {
  return new ScoreRepository(asRole(env, 'admin-uid', 'admin'));
}

/** Read a doc's data through the privileged context (bypasses rules). */
async function readDoc(...path: [string, ...string[]]): Promise<Record<string, unknown> | null> {
  let out: Record<string, unknown> | null = null;
  await seed(env, async (db) => {
    const snap = await getDoc(doc(db, ...path));
    out = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
  });
  return out;
}

interface SeededTeamResult { teamId: string; teamName: string; [k: string]: unknown }
interface SeededAccolade { shooterName: string; teamName: string; [k: string]: unknown }

async function seedSeasonData(): Promise<void> {
  await seed(env, async (db) => {
    await setDoc(doc(db, 'seasons', String(YEAR)), {
      year: YEAR,
      status: 'active',
      currentWeek: 2,
      standings: [
        { rank: 1, teamId: 'eagles', teamName: 'Eagles', totalRankPoints: 60, totalBonusPoints: 10, totalTargets: 400 },
        { rank: 2, teamId: 'hawks', teamName: 'Hawks', totalRankPoints: 56, totalBonusPoints: 8, totalTargets: 380 },
      ],
    });
    await setDoc(doc(db, 'seasons', String(YEAR), 'teams', 'eagles'), { name: 'Eagles', captain: 'Alice', shooters: [] });
    await setDoc(doc(db, 'seasons', String(YEAR), 'teams', 'hawks'), { name: 'Hawks', captain: 'Bob', shooters: [] });
    for (const wk of [1, 2]) {
      await setDoc(doc(db, 'seasons', String(YEAR), 'entries', `${wk}_eagles`), {
        weekNumber: wk, teamId: 'eagles', teamName: 'Eagles',
        shooters: [{ name: 'Alice', score1: 20, score2: 20, total: 40 }],
      });
      await setDoc(doc(db, 'seasons', String(YEAR), 'entries', `${wk}_hawks`), {
        weekNumber: wk, teamId: 'hawks', teamName: 'Hawks',
        shooters: [{ name: 'Bob', score1: 19, score2: 19, total: 38 }],
      });
      await setDoc(doc(db, 'seasons', String(YEAR), 'weeks', String(wk)), {
        weekNumber: wk,
        publishedAt: `2026-03-1${wk}`,
        teamResults: [
          { teamId: 'eagles', teamName: 'Eagles', targets: 200, rankPoints: 30, bonusPoints: 5, shooterScores: [{ name: 'Alice', score1: 20, score2: 20, total: 40 }] },
          { teamId: 'hawks', teamName: 'Hawks', targets: 190, rankPoints: 28, bonusPoints: 4, shooterScores: [{ name: 'Bob', score1: 19, score2: 19, total: 38 }] },
        ],
        accolades: [{ shooterName: 'Alice', teamName: 'Eagles', streak: 25, weekNumber: wk }],
      });
    }
  });
}

describe('cascadeTeamRename', () => {
  it('renames the team in every entry and every published week; other teams untouched', async () => {
    const result = await adminRepo().cascadeTeamRename(YEAR, 'eagles', 'Eagles', 'Falcons');
    expect(result.success).toBe(true);

    for (const wk of [1, 2]) {
      const eaglesEntry = await readDoc('seasons', String(YEAR), 'entries', `${wk}_eagles`);
      expect(eaglesEntry?.['teamName']).toBe('Falcons');
      const hawksEntry = await readDoc('seasons', String(YEAR), 'entries', `${wk}_hawks`);
      expect(hawksEntry?.['teamName']).toBe('Hawks');

      const week = await readDoc('seasons', String(YEAR), 'weeks', String(wk));
      const results = week?.['teamResults'] as SeededTeamResult[];
      expect(results.find((tr) => tr.teamId === 'eagles')?.teamName).toBe('Falcons');
      expect(results.find((tr) => tr.teamId === 'hawks')?.teamName).toBe('Hawks');
    }
  });

  it('is a no-op for a name that appears nowhere', async () => {
    const result = await adminRepo().cascadeTeamRename(YEAR, 'ghosts', 'Ghosts', 'Specters');
    expect(result.success).toBe(true);
    const week = await readDoc('seasons', String(YEAR), 'weeks', '1');
    const results = week?.['teamResults'] as SeededTeamResult[];
    expect(results.map((tr) => tr.teamName).sort()).toEqual(['Eagles', 'Hawks']);
  });
});

describe('deleteTeam', () => {
  it('removes the team doc, its entries, its teamResults/accolades, and its standings row', async () => {
    const result = await adminRepo().deleteTeam(YEAR, 'eagles');
    expect(result.success).toBe(true);

    expect(await readDoc('seasons', String(YEAR), 'teams', 'eagles')).toBeNull();
    for (const wk of [1, 2]) {
      expect(await readDoc('seasons', String(YEAR), 'entries', `${wk}_eagles`)).toBeNull();

      const week = await readDoc('seasons', String(YEAR), 'weeks', String(wk));
      const results = week?.['teamResults'] as SeededTeamResult[];
      expect(results.map((tr) => tr.teamId)).toEqual(['hawks']);
      // Accolades belonging to the deleted team are cascade-removed too
      expect((week?.['accolades'] as SeededAccolade[])).toHaveLength(0);
    }

    const season = await readDoc('seasons', String(YEAR));
    const standings = season?.['standings'] as { teamId: string }[];
    expect(standings.map((s) => s.teamId)).toEqual(['hawks']);
  });

  it('leaves the other team fully intact', async () => {
    const result = await adminRepo().deleteTeam(YEAR, 'eagles');
    expect(result.success).toBe(true);

    const hawks = await readDoc('seasons', String(YEAR), 'teams', 'hawks');
    expect(hawks?.['name']).toBe('Hawks');
    for (const wk of [1, 2]) {
      const entry = await readDoc('seasons', String(YEAR), 'entries', `${wk}_hawks`);
      expect(entry?.['teamName']).toBe('Hawks');
      const week = await readDoc('seasons', String(YEAR), 'weeks', String(wk));
      const results = week?.['teamResults'] as SeededTeamResult[];
      expect(results.find((tr) => tr.teamId === 'hawks')?.['targets']).toBe(190);
    }
  });

  it('deleting a nonexistent team succeeds without disturbing existing data', async () => {
    const result = await adminRepo().deleteTeam(YEAR, 'ghosts');
    expect(result.success).toBe(true);
    const week = await readDoc('seasons', String(YEAR), 'weeks', '1');
    expect((week?.['teamResults'] as SeededTeamResult[])).toHaveLength(2);
    const season = await readDoc('seasons', String(YEAR));
    expect((season?.['standings'] as unknown[])).toHaveLength(2);
  });
});
