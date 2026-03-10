import type { Timestamp } from 'firebase/firestore';

export interface Announcement {
  id: string;
  year: number;
  title: string;
  body: string;
  postedAt: Timestamp;
  lastEditedAt: Timestamp | null;
}
