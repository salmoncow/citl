import type { Timestamp } from 'firebase/firestore';

export interface Announcement {
  id: string;
  year: number;
  title: string;
  body: string;
  postedAt: Timestamp;
  lastEditedAt: Timestamp | null;
  /** Emailed to `news` subscribers when posted (spec 011); missing on older posts. */
  email?: boolean;
}
