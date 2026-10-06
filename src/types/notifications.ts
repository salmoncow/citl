/**
 * Email notification preferences (spec 011 F15).
 *
 * `notificationSettings/{uid}`: one boolean per topic; a missing topic
 * means off. `requests` is the admin digest and only offered to admins
 * and owners.
 */

import type { Timestamp } from 'firebase/firestore';

export type NotificationTopic = 'news' | 'scores' | 'schedule' | 'requests';

export type NotificationTopics = Partial<Record<NotificationTopic, boolean>>;

export interface NotificationSettingsDoc {
  topics: NotificationTopics;
  updatedAt: Timestamp;
}
