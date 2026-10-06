/**
 * NotificationService — email preferences (spec 011 F15, AC-2, AC-3).
 *
 * Which topics a member is offered, the defaults at profile completion,
 * and the save payload. Loaded only by the /account chunk, like
 * AccountService, so it stays out of the main bundle (§III.4).
 */

import { db } from '@/firebase-config';
import { NotificationRepository } from '@/repositories/notification-repository';
import { type Result, success, failure } from '@/types/result';
import type { NotificationTopic, NotificationTopics } from '@/types/notifications';
import type { Role } from '@/types/user';

export interface TopicOption {
  topic: NotificationTopic;
  label: string;
  description: string;
}

const MEMBER_TOPICS: readonly TopicOption[] = [
  { topic: 'news', label: 'League news', description: 'Announcements the coordinator chooses to email.' },
  { topic: 'scores', label: 'Score results', description: 'When a week’s results are posted.' },
  { topic: 'schedule', label: 'Schedule changes', description: 'When an upcoming shoot date moves or is cancelled.' },
];

const ADMIN_TOPIC: TopicOption = {
  topic: 'requests',
  label: 'New requests',
  description: 'A morning summary when members send requests to review.',
};

/** Topics offered to a member; New requests is for admins and owners only. */
export function topicOptions(role: Role | null): TopicOption[] {
  return role === 'admin' || role === 'owner' ? [...MEMBER_TOPICS, ADMIN_TOPIC] : [...MEMBER_TOPICS];
}

/** Pre-checked topics at profile completion (Decision 2). */
export function defaultTopics(): NotificationTopics {
  return Object.fromEntries(MEMBER_TOPICS.map((o) => [o.topic, true]));
}

/** Explicit true/false for each offered topic; anything else is dropped. */
export function settingsPayload(role: Role | null, checked: ReadonlySet<NotificationTopic>): NotificationTopics {
  return Object.fromEntries(topicOptions(role).map((o) => [o.topic, checked.has(o.topic)]));
}

export class NotificationService {
  constructor(private readonly repo: NotificationRepository) {}

  /** `null` data: never saved (members from before M4 see a prompt). */
  async load(uid: string): Promise<Result<NotificationTopics | null>> {
    try {
      const doc = await this.repo.find(uid);
      return success(doc ? doc.topics : null);
    } catch (e) {
      console.error('[NotificationService] load failed:', e);
      return failure(String(e), (e as { code?: string })?.code ?? 'LOAD_ERROR');
    }
  }

  async save(uid: string, role: Role | null, checked: ReadonlySet<NotificationTopic>): Promise<Result<NotificationTopics>> {
    const topics = settingsPayload(role, checked);
    try {
      await this.repo.save(uid, topics);
      return success(topics);
    } catch (e) {
      console.error('[NotificationService] save failed:', e);
      return failure(String(e), (e as { code?: string })?.code ?? 'WRITE_ERROR');
    }
  }
}

let instance: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!instance) instance = new NotificationService(new NotificationRepository(db));
  return instance;
}
