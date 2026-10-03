/**
 * Pure roster publishing rules for coordinator review (spec 010 AC-8,
 * AC-10, AC-14; DD-2, DD-3).
 *
 * No Firestore access: the review handlers read the season team doc and
 * the team's score entries, then pass what these helpers need.
 *
 * A season team doc's shooters have the shape the admin roster modal
 * writes (src/types/shooter.ts). Matching is by normalizeName, the server
 * twin of normalizeShooterName.
 */

import {
  ROSTER_MAX,
  minorDisplayName,
  normalizeName,
  type DependentNames,
  type RosterEntry,
} from './roster.js';

export const AVERAGE_MIN = 0;
export const AVERAGE_MAX = 50;

/** One shooter on seasons/{year}/teams/{teamId}.shooters. */
export interface TeamShooter {
  id: string;
  name: string;
  rookie: boolean;
  startingAvg: number;
  finalAvg: number | null;
  weeksShot: number | null;
  scores: (number | null)[];
}

/** The coordinator's starting average and rookie flag for a shooter new to the team. */
export interface ShooterSetting {
  name: string;
  startingAvg: number;
  rookie: boolean;
}

export type PublishErrorReason =
  | 'missing-average'
  | 'shooter-has-scores'
  | 'roster-too-long'
  | 'duplicate-name';

export class PublishError extends Error {
  constructor(readonly reason: PublishErrorReason, message: string) {
    super(message);
  }
}

/** Read a stored shooter defensively; legacy docs may lack fields. */
export function toTeamShooter(raw: unknown): TeamShooter | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;
  if (typeof s['name'] !== 'string' || !s['name'].trim()) return null;
  return {
    id: typeof s['id'] === 'string' ? s['id'] : '',
    name: s['name'],
    rookie: s['rookie'] === true,
    startingAvg: typeof s['startingAvg'] === 'number' ? s['startingAvg'] : 35,
    finalAvg: typeof s['finalAvg'] === 'number' ? s['finalAvg'] : null,
    weeksShot: typeof s['weeksShot'] === 'number' ? s['weeksShot'] : null,
    scores: Array.isArray(s['scores']) ? (s['scores'] as (number | null)[]) : [],
  };
}

function settingsByKey(settings: readonly ShooterSetting[]): Map<string, ShooterSetting> {
  return new Map(settings.map((s) => [normalizeName(s.name), s]));
}

function newShooter(name: string, setting: ShooterSetting | undefined): TeamShooter {
  if (!setting || !Number.isFinite(setting.startingAvg)
      || setting.startingAvg < AVERAGE_MIN || setting.startingAvg > AVERAGE_MAX) {
    throw new PublishError('missing-average', `Set a starting average between ${AVERAGE_MIN} and ${AVERAGE_MAX} for ${name}.`);
  }
  return {
    id: '',
    name,
    rookie: setting.rookie,
    startingAvg: setting.startingAvg,
    finalAvg: null,
    weeksShot: null,
    scores: [],
  };
}

function assertRosterShape(shooters: readonly TeamShooter[]): void {
  if (shooters.length > ROSTER_MAX) {
    throw new PublishError('roster-too-long', `A team can have at most ${ROSTER_MAX} shooters.`);
  }
  const seen = new Set<string>();
  for (const s of shooters) {
    const key = normalizeName(s.name);
    if (seen.has(key)) throw new PublishError('duplicate-name', `${s.name} is already on this team.`);
    seen.add(key);
  }
}

/** Names on the current team doc that the given roster would drop. */
export function droppedNames(current: readonly TeamShooter[], names: readonly string[]): string[] {
  const keep = new Set(names.map(normalizeName));
  return current.filter((s) => !keep.has(normalizeName(s.name))).map((s) => s.name);
}

/**
 * Replace a team's roster with an approved proposal's names (AC-8).
 * Shooters already on the team keep their stored record; new ones need a
 * setting; dropped ones must have no scores (`scoredKeys` holds the
 * normalized names with a score entry this season).
 */
export function replaceRoster(
  current: readonly TeamShooter[],
  names: readonly string[],
  settings: readonly ShooterSetting[],
  scoredKeys: ReadonlySet<string>,
): TeamShooter[] {
  const existing = new Map(current.map((s) => [normalizeName(s.name), s]));
  const bySetting = settingsByKey(settings);

  for (const name of droppedNames(current, names)) {
    if (scoredKeys.has(normalizeName(name))) {
      throw new PublishError('shooter-has-scores',
        `${name} already has scores this season, so they can't be dropped here. Remove them in Team Management.`);
    }
  }

  const next = names.map((name) => existing.get(normalizeName(name)) ?? newShooter(name, bySetting.get(normalizeName(name))));
  assertRosterShape(next);
  return next;
}

/** Add placed shooters to the end of a team's roster (AC-10). */
export function addToRoster(
  current: readonly TeamShooter[],
  names: readonly string[],
  settings: readonly ShooterSetting[],
): TeamShooter[] {
  const bySetting = settingsByKey(settings);
  const next = [...current, ...names.map((name) => newShooter(name, bySetting.get(normalizeName(name))))];
  assertRosterShape(next);
  return next;
}

export interface RebuildContext {
  /** The captain's roster name (approved link, else profile name). */
  selfName: string;
  /** The captain's dependents, by id. */
  dependents: ReadonlyMap<string, DependentNames>;
  /** The proposal's previous roster, for minor flags and guardians of named entries. */
  previous: readonly RosterEntry[];
}

/**
 * Rebuild a draft roster from the published team doc (AC-14, DD-3): the
 * captain's name becomes `self`, a dependent's "First L." becomes that
 * dependent, and everything else is `named`, keeping the minor flag and
 * guardian it had on the previous roster.
 */
export function rosterFromTeam(shooters: readonly TeamShooter[], ctx: RebuildContext): RosterEntry[] {
  const selfKey = normalizeName(ctx.selfName);
  const depByKey = new Map<string, string>();
  for (const [id, d] of ctx.dependents) depByKey.set(normalizeName(minorDisplayName(d.firstName, d.lastName)), id);
  const prevByKey = new Map(ctx.previous.map((e) => [normalizeName(e.name), e]));

  let selfSeen = false;
  return shooters.map((s): RosterEntry => {
    const key = normalizeName(s.name);
    if (key === selfKey && !selfSeen) {
      selfSeen = true;
      return { kind: 'self', name: ctx.selfName, rookie: s.rookie, minor: false };
    }
    const depId = depByKey.get(key);
    if (depId) {
      return { kind: 'dependent', name: s.name, rookie: s.rookie, minor: true, dependentId: depId };
    }
    const prev = prevByKey.get(key);
    const entry: RosterEntry = { kind: 'named', name: s.name, rookie: s.rookie, minor: prev?.minor === true };
    if (entry.minor && prev?.guardianName) entry.guardianName = prev.guardianName;
    return entry;
  });
}
