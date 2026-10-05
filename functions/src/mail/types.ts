/**
 * Mail queue shapes (spec 011 AC-7). Every email is a mail/{id} doc
 * written server-side and sent once by sendMail.
 */

/** Member-selectable topics; mirrors src/types/notifications.ts and firestore.rules. */
export const TOPICS = ['news', 'scores', 'schedule', 'requests'] as const;
export type Topic = (typeof TOPICS)[number];

export const TOPIC_LABELS: Record<Topic, string> = {
  news: 'League news',
  scores: 'Score results',
  schedule: 'Schedule changes',
  requests: 'New requests',
};

export type MailKind = 'news' | 'scores' | 'schedule' | 'status' | 'digest';

export type MailStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';

/** What a message says; sendMail renders it with the recipient's footer. */
export interface MailContent {
  subject: string;
  /** Plain-text paragraphs, in order. Rendered escaped. */
  paragraphs: string[];
  /** One call to action, a citl.club path such as '/#/standings'. */
  link?: { label: string; path: string };
}

/** Fields written when a message is queued (createdAt/expireAt added by the writer). */
export interface QueuedMail extends MailContent {
  uid: string;
  kind: MailKind;
  /** Topic emails only; the sender re-checks it and adds the unsubscribe footer. */
  topic?: Topic;
}
