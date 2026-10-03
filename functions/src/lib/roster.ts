/**
 * Pure roster rules for team proposals (spec 009 AC-6, AC-7, DD-3, DD-4).
 *
 * No Firestore access: the teamProposal callable reads the docs and
 * passes what these helpers need. Limits mirror
 * src/services/league-validation.ts and the profile name rules in
 * firestore.rules (isValidNamePart).
 */

export const ROSTER_MAX = 15;
export const ROSTER_MIN = 5;
export const NAME_PART_MAX = 30;
export const TEAM_NAME_MIN = 2;
export const TEAM_NAME_MAX = 40;

export const NAME_PART_PATTERN = /^\p{L}[\p{L}\p{M} .'-]*$/u;
export const TEAM_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\p{M} &'.-]*$/u;

/** Parity with normalizeShooterName in src/services/scoring-engine.ts. */
export function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

/** Parity with _slugify in src/services/score-service.ts (season team doc ids). */
export function slugifyTeamName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

/** "Sam Doe" → "Sam D." — the only form of a minor's name outside the dependents doc. */
export function minorDisplayName(firstName: string, lastName: string): string {
  const initial = Array.from(lastName.trim())[0] ?? '';
  return `${firstName.trim()} ${initial.toLocaleUpperCase()}.`;
}

export type RosterEntryInput =
  | { kind: 'self'; rookie: boolean }
  | { kind: 'dependent'; dependentId: string; rookie: boolean }
  | {
      kind: 'named';
      firstName: string;
      lastName: string;
      rookie: boolean;
      minor: boolean;
      guardianName?: string | null | undefined;
    };

export interface RosterEntry {
  kind: 'self' | 'dependent' | 'named';
  name: string;
  rookie: boolean;
  minor: boolean;
  dependentId?: string;
  guardianName?: string;
}

export interface DependentNames {
  firstName: string;
  lastName: string;
}

export interface RosterContext {
  /** The captain's roster name: the approved shooter link, else the profile name. */
  selfName: string;
  /** The caller's own dependents, by id. An id not in the map is not theirs (or is gone). */
  dependents: ReadonlyMap<string, DependentNames>;
}

export type RosterErrorReason =
  | 'roster-too-long'
  | 'roster-too-short'
  | 'self-count'
  | 'duplicate-name'
  | 'unknown-dependent'
  | 'guardian-required'
  | 'guardian-not-adult';

export class RosterError extends Error {
  constructor(readonly reason: RosterErrorReason, message: string) {
    super(message);
  }
}

/** Resolve input entries to stored entries and enforce the draft rules. */
export function resolveRoster(entries: readonly RosterEntryInput[], ctx: RosterContext): RosterEntry[] {
  if (entries.length > ROSTER_MAX) {
    throw new RosterError('roster-too-long', `A roster can have at most ${ROSTER_MAX} shooters.`);
  }

  const resolved: RosterEntry[] = entries.map((e) => {
    switch (e.kind) {
      case 'self':
        return { kind: 'self', name: ctx.selfName, rookie: e.rookie, minor: false };
      case 'dependent': {
        const dep = ctx.dependents.get(e.dependentId);
        if (!dep) {
          throw new RosterError('unknown-dependent', 'One of the dependents on this roster is no longer on your account.');
        }
        return {
          kind: 'dependent',
          name: minorDisplayName(dep.firstName, dep.lastName),
          rookie: e.rookie,
          minor: true,
          dependentId: e.dependentId,
        };
      }
      case 'named': {
        const first = e.firstName.trim();
        const last = e.lastName.trim();
        const entry: RosterEntry = {
          kind: 'named',
          name: e.minor ? minorDisplayName(first, last) : `${first} ${last}`,
          rookie: e.rookie,
          minor: e.minor,
        };
        if (e.minor && e.guardianName) entry.guardianName = e.guardianName.trim();
        return entry;
      }
    }
  });

  checkRoster(resolved);
  return resolved;
}

/** Roster-wide rules shared by save and submit. */
function checkRoster(resolved: readonly RosterEntry[]): void {
  if (resolved.filter((e) => e.kind === 'self').length > 1) {
    throw new RosterError('self-count', 'You can be on the roster only once.');
  }

  const seen = new Set<string>();
  for (const e of resolved) {
    const key = normalizeName(e.name);
    if (seen.has(key)) {
      throw new RosterError('duplicate-name', `${e.name} is on the roster more than once.`);
    }
    seen.add(key);
  }

  const byName = new Map(resolved.map((e) => [normalizeName(e.name), e]));
  for (const e of resolved) {
    if (e.kind !== 'named' || !e.minor) continue;
    if (!e.guardianName) {
      throw new RosterError('guardian-required', `${e.name} is under 18 and needs a guardian on the roster.`);
    }
    const guardian = byName.get(normalizeName(e.guardianName));
    if (!guardian || guardian.minor) {
      throw new RosterError('guardian-not-adult', `${e.name}'s guardian must be an adult on this roster.`);
    }
  }
}

/** Extra rules that apply only when a roster is submitted. */
export function assertSubmittable(roster: readonly RosterEntry[]): void {
  if (roster.length < ROSTER_MIN) {
    throw new RosterError('roster-too-short', `A team needs at least ${ROSTER_MIN} shooters.`);
  }
  if (roster.filter((e) => e.kind === 'self').length !== 1) {
    throw new RosterError('self-count', 'Add yourself to the roster before submitting.');
  }
}

/**
 * Re-resolve the server-derived names of a stored roster (self and
 * dependents) on submit, so a renamed profile or dependent is picked up
 * and a removed dependent is caught. Named entries are kept as stored.
 */
export function refreshRoster(roster: readonly RosterEntry[], ctx: RosterContext): RosterEntry[] {
  const refreshed = roster.map((e): RosterEntry => {
    if (e.kind === 'self') return { ...e, name: ctx.selfName };
    if (e.kind === 'dependent') {
      const dep = e.dependentId ? ctx.dependents.get(e.dependentId) : undefined;
      if (!dep) {
        throw new RosterError('unknown-dependent', 'One of the dependents on this roster is no longer on your account.');
      }
      return { ...e, name: minorDisplayName(dep.firstName, dep.lastName) };
    }
    return { ...e };
  });
  checkRoster(refreshed);
  return refreshed;
}
