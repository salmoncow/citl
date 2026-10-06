/**
 * Topic email triggers (spec 011 AC-12 – AC-14, DD-2, DD-4):
 *   - onAnnouncementCreated: announcements/{id} with email: true → news
 *   - onWeekPublished:       seasons/{year}/weeks/{n} created → scores
 *   - onSeasonUpdated:       seasons/{year}.weekDateOverrides changed → schedule
 *
 * Each runs only for the current calendar year (and a season not marked
 * complete), so seed and import scripts writing past seasons send nothing,
 * and each fans out under a dedupe key so a retried event sends once.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, type DocumentData } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { fanOut } from './lib/fanout.js';
import {
  newsContent, scheduleChanges, scheduleContent, scoresContent,
  type Overrides, type WeekTeam,
} from './mail/builders.js';

if (getApps().length === 0) {
  initializeApp();
}

const DAY_MS = 24 * 60 * 60 * 1000;
const OPTIONS = { region: 'us-central1', retry: true, maxInstances: 1 } as const;

const currentYear = (now: number) => new Date(now).getUTCFullYear();

export async function handleAnnouncementCreated(id: string, data: DocumentData, now: number = Date.now()): Promise<number | null> {
  if (data['email'] !== true || Number(data['year']) !== currentYear(now)) return null;
  const title = String(data['title'] ?? '').trim();
  if (!title) return null;
  return fanOut(getFirestore(), `news_${id}`, 'news', 'news', newsContent(title, String(data['body'] ?? '')), now);
}

async function isOpenSeason(year: number, now: number): Promise<DocumentData | null> {
  if (year !== currentYear(now)) return null;
  const season = (await getFirestore().doc(`seasons/${year}`).get()).data();
  return season && season['status'] !== 'complete' ? season : null;
}

export async function handleWeekPublished(year: number, week: number, data: DocumentData, now: number = Date.now()): Promise<number | null> {
  const publishedAt = Date.parse(String(data['publishedAt'] ?? ''));
  if (!Number.isFinite(publishedAt) || now - publishedAt > DAY_MS) return null;
  if (!(await isOpenSeason(year, now))) return null;
  const teams: WeekTeam[] = (Array.isArray(data['teamResults']) ? data['teamResults'] : [])
    .map((t: DocumentData) => ({ teamName: String(t['teamName'] ?? ''), targets: Number(t['targets'] ?? 0) }))
    .filter((t: WeekTeam) => t.teamName);
  return fanOut(getFirestore(), `scores_${year}_${week}`, 'scores', 'scores', scoresContent(year, week, teams), now);
}

/** eventId keys the fan-out: a retried event sends once, a later real change sends again. */
export async function handleSeasonUpdated(
  eventId: string, year: number, before: DocumentData, after: DocumentData, now: number = Date.now(),
): Promise<number | null> {
  if (year !== currentYear(now) || after['status'] === 'complete') return null;
  const changes = scheduleChanges(
    (before['weekDateOverrides'] ?? {}) as Overrides,
    (after['weekDateOverrides'] ?? {}) as Overrides,
    Number(after['currentWeek'] ?? 0),
  );
  if (changes.length === 0) return null;
  return fanOut(getFirestore(), `schedule_${year}_${eventId}`, 'schedule', 'schedule', scheduleContent(year, changes), now);
}

export const onAnnouncementCreated = onDocumentCreated({ ...OPTIONS, document: 'announcements/{id}' }, async (event) => {
  const data = event.data?.data();
  if (data) await handleAnnouncementCreated(event.params.id, data);
});

export const onWeekPublished = onDocumentCreated({ ...OPTIONS, document: 'seasons/{year}/weeks/{week}' }, async (event) => {
  const data = event.data?.data();
  if (data) await handleWeekPublished(Number(event.params.year), Number(event.params.week), data);
});

export const onSeasonUpdated = onDocumentUpdated({ ...OPTIONS, document: 'seasons/{year}' }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (before && after) await handleSeasonUpdated(event.id, Number(event.params.year), before, after);
});
