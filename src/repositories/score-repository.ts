/**
 * ScoreRepository — Firestore implementation
 *
 * Data access layer for seasons, teams, shooters, and weekly results.
 * All public methods return a Result object — never throw across module boundaries.
 *
 * Architecture: components → modules → services → repositories
 * This file is the innermost layer; it may only import from firebase/firestore and types.
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';

import type { Team, WeekResult, SeasonEntry } from '@/types/score';
import type { Season, SeasonStandings } from '@/types/season';
import type { Announcement } from '@/types/announcement';

// ---------------------------------------------------------------------------
// Result type + helpers
// ---------------------------------------------------------------------------

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };

export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

export function failure(error: string, code = 'UNKNOWN_ERROR'): Result<never> {
  return { success: false, error, code };
}

// ---------------------------------------------------------------------------
// ScoreRepository
// ---------------------------------------------------------------------------

export class ScoreRepository {
  private readonly db: Firestore;

  constructor(db: Firestore) {
    if (!db) throw new Error('Firestore db instance is required');
    this.db = db;
  }

  // -------------------------------------------------------------------------
  // Seasons
  // -------------------------------------------------------------------------

  async getSeason(year: number): Promise<Result<Season | null>> {
    try {
      const ref = doc(this.db, 'seasons', String(year));
      const snap = await getDoc(ref);
      if (!snap.exists()) return success(null);
      return success({ id: snap.id, ...snap.data() } as Season);
    } catch (err) {
      return failure(`Failed to load season ${year}: ${(err as Error).message}`, 'FIRESTORE_READ_ERROR');
    }
  }

  async getAllSeasons(): Promise<Result<Season[]>> {
    try {
      const q = query(
        collection(this.db, 'seasons'),
        orderBy('year', 'desc'),
        limit(20),
      );
      const snap = await getDocs(q);
      const seasons = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Season));
      return success(seasons);
    } catch (err) {
      return failure(`Failed to load seasons: ${(err as Error).message}`, 'FIRESTORE_READ_ERROR');
    }
  }

  // -------------------------------------------------------------------------
  // Teams
  // -------------------------------------------------------------------------

  async getTeams(year: number): Promise<Result<Team[]>> {
    try {
      const q = query(
        collection(this.db, 'seasons', String(year), 'teams'),
        orderBy('name', 'asc'),
        limit(20),
      );
      const snap = await getDocs(q);
      const teams = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Team));
      return success(teams);
    } catch (err) {
      return failure(`Failed to load teams for ${year}: ${(err as Error).message}`, 'FIRESTORE_READ_ERROR');
    }
  }

  async getTeam(year: number, teamId: string): Promise<Result<Team | null>> {
    try {
      const ref = doc(this.db, 'seasons', String(year), 'teams', teamId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return success(null);
      return success({ id: snap.id, ...snap.data() } as Team);
    } catch (err) {
      return failure(`Failed to load team ${teamId}: ${(err as Error).message}`, 'FIRESTORE_READ_ERROR');
    }
  }

  // -------------------------------------------------------------------------
  // Weekly results
  // -------------------------------------------------------------------------

  async getWeekResult(year: number, weekNumber: number): Promise<Result<WeekResult | null>> {
    try {
      const ref = doc(this.db, 'seasons', String(year), 'weeks', String(weekNumber));
      const snap = await getDoc(ref);
      if (!snap.exists()) return success(null);
      return success({ id: snap.id, ...snap.data() } as unknown as WeekResult);
    } catch (err) {
      return failure(
        `Failed to load week ${weekNumber} for ${year}: ${(err as Error).message}`,
        'FIRESTORE_READ_ERROR',
      );
    }
  }

  async getAllWeekResults(year: number): Promise<Result<WeekResult[]>> {
    try {
      const q = query(
        collection(this.db, 'seasons', String(year), 'weeks'),
        orderBy('weekNumber', 'asc'),
        limit(15),
      );
      const snap = await getDocs(q);
      const weeks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as WeekResult));
      return success(weeks);
    } catch (err) {
      return failure(
        `Failed to load week results for ${year}: ${(err as Error).message}`,
        'FIRESTORE_READ_ERROR',
      );
    }
  }

  async getLatestWeekResult(year: number): Promise<Result<WeekResult | null>> {
    try {
      const q = query(
        collection(this.db, 'seasons', String(year), 'weeks'),
        orderBy('weekNumber', 'desc'),
        limit(1),
      );
      const snap = await getDocs(q);
      if (snap.empty) return success(null);
      const d = snap.docs[0]!;
      return success({ id: d.id, ...d.data() } as unknown as WeekResult);
    } catch (err) {
      return failure(
        `Failed to load latest week for ${year}: ${(err as Error).message}`,
        'FIRESTORE_READ_ERROR',
      );
    }
  }

  // -------------------------------------------------------------------------
  // Admin writes
  // -------------------------------------------------------------------------

  async saveEntry(year: number, entry: SeasonEntry): Promise<Result<SeasonEntry & { id: string }>> {
    try {
      if (!entry || !entry.weekNumber || !entry.teamId) {
        return failure('entry.weekNumber and entry.teamId are required', 'VALIDATION_ERROR');
      }
      const entryId = `${entry.weekNumber}_${entry.teamId}`;
      const ref = doc(this.db, 'seasons', String(year), 'entries', entryId);
      await setDoc(ref, entry);
      return success({ ...entry, id: entryId });
    } catch (err) {
      return failure(`Failed to save entry: ${(err as Error).message}`, 'FIRESTORE_WRITE_ERROR');
    }
  }

  async getEntry(year: number, weekNumber: number, teamId: string): Promise<Result<SeasonEntry | null>> {
    try {
      const entryId = `${weekNumber}_${teamId}`;
      const ref = doc(this.db, 'seasons', String(year), 'entries', entryId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return success(null);
      return success({ id: snap.id, ...snap.data() } as unknown as SeasonEntry);
    } catch (err) {
      return failure(`Failed to load entry: ${(err as Error).message}`, 'FIRESTORE_READ_ERROR');
    }
  }

  async getEntries(year: number, maxWeekNumber: number): Promise<Result<SeasonEntry[]>> {
    try {
      const q = query(
        collection(this.db, 'seasons', String(year), 'entries'),
        where('weekNumber', '<=', maxWeekNumber),
        limit(maxWeekNumber * 10),
      );
      const snap = await getDocs(q);
      const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as SeasonEntry));
      return success(entries);
    } catch (err) {
      return failure(`Failed to load entries: ${(err as Error).message}`, 'FIRESTORE_READ_ERROR');
    }
  }

  async publishWeek(
    year: number,
    weekResult: WeekResult,
    seasonUpdates: { currentWeek: number; standings: SeasonStandings[]; status: string },
  ): Promise<Result<{ weekResult: WeekResult; seasonUpdates: typeof seasonUpdates }>> {
    try {
      if (!weekResult || !weekResult.weekNumber) {
        return failure('weekResult.weekNumber is required', 'VALIDATION_ERROR');
      }
      const batch = writeBatch(this.db);

      const weekRef = doc(
        this.db,
        'seasons',
        String(year),
        'weeks',
        String(weekResult.weekNumber),
      );
      batch.set(weekRef, weekResult);

      const seasonRef = doc(this.db, 'seasons', String(year));
      batch.set(seasonRef, { year, ...seasonUpdates }, { merge: true });

      await batch.commit();
      return success({ weekResult, seasonUpdates });
    } catch (err) {
      return failure(`Failed to publish week: ${(err as Error).message}`, 'FIRESTORE_WRITE_ERROR');
    }
  }

  async updateSeason(year: number, updates: Partial<Season>): Promise<Result<Partial<Season>>> {
    try {
      const ref = doc(this.db, 'seasons', String(year));
      await updateDoc(ref, updates as Record<string, unknown>);
      return success(updates);
    } catch (err) {
      return failure(`Failed to update season ${year}: ${(err as Error).message}`, 'FIRESTORE_WRITE_ERROR');
    }
  }

  async updateTeamMeta(
    year: number,
    teamId: string,
    updates: { name: string; captain: string },
  ): Promise<Result<void>> {
    try {
      const ref = doc(this.db, 'seasons', String(year), 'teams', teamId);
      await updateDoc(ref, updates as Record<string, unknown>);
      return success(undefined);
    } catch (err) {
      return failure(`Failed to update team: ${(err as Error).message}`, 'FIRESTORE_WRITE_ERROR');
    }
  }

  async cascadeTeamRename(
    year: number,
    _teamId: string,
    oldName: string,
    newName: string,
  ): Promise<Result<void>> {
    try {
      const batch = writeBatch(this.db);

      // 1. Entries: query by teamName field
      const entriesRef = collection(this.db, 'seasons', String(year), 'entries');
      const entriesSnap = await getDocs(
        query(entriesRef, where('teamName', '==', oldName)),
      );
      for (const d of entriesSnap.docs) {
        batch.update(d.ref, { teamName: newName });
      }

      // 2. Week results: read all weeks, patch the matching teamResults element
      const weeksRef = collection(this.db, 'seasons', String(year), 'weeks');
      const weeksSnap = await getDocs(weeksRef);
      for (const d of weeksSnap.docs) {
        const data = d.data() as { teamResults?: { teamName: string }[] };
        const results = data.teamResults ?? [];
        if (results.some((r) => r.teamName === oldName)) {
          const updated = results.map((r) =>
            r.teamName === oldName ? { ...r, teamName: newName } : r,
          );
          batch.update(d.ref, { teamResults: updated });
        }
      }

      await batch.commit();
      return success(undefined);
    } catch (err) {
      return failure(
        `Failed to cascade team rename: ${(err as Error).message}`,
        'FIRESTORE_WRITE_ERROR',
      );
    }
  }

  async createTeam(
    year: number,
    teamId: string,
    team: Omit<Team, 'id'>,
  ): Promise<Result<Team>> {
    try {
      const batch = writeBatch(this.db);
      // Ensure season document exists (merge — don't overwrite existing data)
      const seasonRef = doc(this.db, 'seasons', String(year));
      batch.set(seasonRef, { year }, { merge: true });
      // Create team document
      const teamRef = doc(this.db, 'seasons', String(year), 'teams', teamId);
      batch.set(teamRef, team);
      await batch.commit();
      return success({ id: teamId, ...team });
    } catch (err) {
      return failure(`Failed to create team: ${(err as Error).message}`, 'FIRESTORE_WRITE_ERROR');
    }
  }

  async deleteTeam(year: number, teamId: string): Promise<Result<void>> {
    try {
      const batch = writeBatch(this.db);

      // Delete the team document
      batch.delete(doc(this.db, 'seasons', String(year), 'teams', teamId));

      // Delete all entry documents for this team (weeks 1–15)
      // batch.delete on a non-existent doc is a safe no-op
      for (let week = 1; week <= 15; week++) {
        batch.delete(
          doc(this.db, 'seasons', String(year), 'entries', `${week}_${teamId}`),
        );
      }

      await batch.commit();

      // Step 2: cascade-remove team from published week results + season standings
      const [weeksSnap, seasonSnap] = await Promise.all([
        getDocs(collection(this.db, 'seasons', String(year), 'weeks')),
        getDoc(doc(this.db, 'seasons', String(year))),
      ]);

      const batch2 = writeBatch(this.db);
      let batch2HasOps = false;

      for (const weekDoc of weeksSnap.docs) {
        const data = weekDoc.data() as { teamResults?: { teamId: string }[] };
        const before = data.teamResults ?? [];
        const after = before.filter((tr) => tr.teamId !== teamId);
        if (after.length !== before.length) {
          batch2.update(weekDoc.ref, { teamResults: after });
          batch2HasOps = true;
        }
      }

      if (seasonSnap.exists()) {
        const standings = (seasonSnap.data()['standings'] ?? []) as { teamId: string }[];
        const filtered = standings.filter((s) => s.teamId !== teamId);
        if (filtered.length !== standings.length) {
          batch2.update(seasonSnap.ref, { standings: filtered });
          batch2HasOps = true;
        }
      }

      if (batch2HasOps) await batch2.commit();

      return success(undefined);
    } catch (err) {
      return failure(`Failed to delete team: ${(err as Error).message}`, 'FIRESTORE_WRITE_ERROR');
    }
  }

  async removeShooterFromRosterAndEntries(
    year: number,
    teamId: string,
    updatedShooters: Team['shooters'],
    entryUpdates: SeasonEntry[],
  ): Promise<Result<void>> {
    try {
      const batch = writeBatch(this.db);

      // Update team document's shooters array
      batch.update(
        doc(this.db, 'seasons', String(year), 'teams', teamId),
        { shooters: updatedShooters },
      );

      // Overwrite each entry that contained the shooter (with shooter filtered out)
      for (const entry of entryUpdates) {
        batch.set(
          doc(this.db, 'seasons', String(year), 'entries', `${entry.weekNumber}_${teamId}`),
          entry,
        );
      }

      await batch.commit();
      return success(undefined);
    } catch (err) {
      return failure(
        `Failed to remove shooter: ${(err as Error).message}`,
        'FIRESTORE_WRITE_ERROR',
      );
    }
  }

  async saveTeamRoster(
    year: number,
    teamId: string,
    updates: { captain: string; shooters: Team['shooters'] },
  ): Promise<Result<void>> {
    try {
      const ref = doc(this.db, 'seasons', String(year), 'teams', teamId);
      await updateDoc(ref, updates as Record<string, unknown>);
      return success(undefined);
    } catch (err) {
      return failure(`Failed to save roster: ${(err as Error).message}`, 'FIRESTORE_WRITE_ERROR');
    }
  }

  // -------------------------------------------------------------------------
  // Announcements
  // -------------------------------------------------------------------------

  async getAnnouncements(year: number): Promise<Result<Announcement[]>> {
    try {
      const q = query(
        collection(this.db, 'announcements'),
        where('year', '==', year),
      );
      const snap = await getDocs(q);
      const announcements = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement));
      announcements.sort((a, b) => b.postedAt.toMillis() - a.postedAt.toMillis());
      return success(announcements);
    } catch (err) {
      return failure(`Failed to load announcements: ${(err as Error).message}`, 'FIRESTORE_ERROR');
    }
  }

  async createAnnouncement(year: number, title: string, body: string): Promise<Result<Announcement>> {
    try {
      const ref = await addDoc(collection(this.db, 'announcements'), {
        year,
        title,
        body,
        postedAt: serverTimestamp(),
        lastEditedAt: null,
      });
      const snap = await getDoc(ref);
      return success({ id: snap.id, ...snap.data() } as Announcement);
    } catch (err) {
      return failure(`Failed to create announcement: ${(err as Error).message}`, 'FIRESTORE_ERROR');
    }
  }

  async updateAnnouncement(id: string, title: string, body: string): Promise<Result<Announcement>> {
    try {
      const ref = doc(this.db, 'announcements', id);
      await updateDoc(ref, { title, body, lastEditedAt: serverTimestamp() });
      const snap = await getDoc(ref);
      return success({ id: snap.id, ...snap.data() } as Announcement);
    } catch (err) {
      return failure(`Failed to update announcement: ${(err as Error).message}`, 'FIRESTORE_ERROR');
    }
  }

  async deleteAnnouncement(id: string): Promise<Result<void>> {
    try {
      await deleteDoc(doc(this.db, 'announcements', id));
      return success(undefined);
    } catch (err) {
      return failure(`Failed to delete announcement: ${(err as Error).message}`, 'FIRESTORE_ERROR');
    }
  }
}
