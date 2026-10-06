/**
 * Fixed mail settings (spec 011 Decision 6, ADR-015). The AWS role ARN is
 * a deploy-time parameter (functions/.env.citl-baed2); the unsubscribe
 * signing key is a Secret Manager secret.
 */

import { defineSecret, defineString } from 'firebase-functions/params';

export const SITE_URL = 'https://citl.club';
export const FROM_ADDRESS = 'news@mail.citl.club';
export const FROM = `Central Illinois Trap League <${FROM_ADDRESS}>`;
/** League contact address (src/utils/contact.ts). */
export const REPLY_TO = 'lmckenna.citl@gmail.com';
export const SES_REGION = 'us-east-1';
export const CONFIGURATION_SET = 'citl-mail';
/** Audience requested on the Google ID token exchanged with STS. */
export const TOKEN_AUDIENCE = 'sts.amazonaws.com';

/** Mail docs are deleted by Firestore TTL this long after creation (AC-7). */
export const MAIL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Send attempts before a retryable error marks the doc failed (AC-8). */
export const MAX_ATTEMPTS = 5;
/** A 'sending' claim older than this is treated as abandoned (AC-8). */
export const CLAIM_STALE_MS = 10 * 60 * 1000;

export const SES_ROLE_ARN = defineString('SES_ROLE_ARN', {
  description: 'IAM role sendMail assumes for SES (citl-mail stack output SenderRoleArn).',
});
export const UNSUBSCRIBE_SECRET = defineSecret('UNSUBSCRIBE_SECRET');
