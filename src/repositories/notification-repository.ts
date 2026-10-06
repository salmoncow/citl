/**
 * NotificationRepository — `notificationSettings/{uid}` (spec 011 F15).
 *
 * Self read and write only. `updatedAt` is serverTimestamp() because the
 * rules require it to equal request.time; the write replaces the doc so
 * its keys stay exactly `topics` and `updatedAt`.
 *
 * Error convention: same as ProfileRepository — methods throw (reject) on
 * Firestore errors; NotificationService wraps them in Result.
 */

import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import type { NotificationSettingsDoc, NotificationTopics } from '@/types/notifications';

export class NotificationRepository {
  constructor(private readonly db: Firestore) {}

  async find(uid: string): Promise<NotificationSettingsDoc | null> {
    const snap = await getDoc(doc(this.db, 'notificationSettings', uid));
    return snap.exists() ? (snap.data() as NotificationSettingsDoc) : null;
  }

  async save(uid: string, topics: NotificationTopics): Promise<void> {
    await setDoc(doc(this.db, 'notificationSettings', uid), { topics, updatedAt: serverTimestamp() });
  }
}
