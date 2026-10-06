/**
 * Signed one-click unsubscribe links (spec 011 AC-4, DD-5). The signature
 * is HMAC-SHA256 over "uid:topic", base64url; there is no expiry, and
 * rotating the secret invalidates every earlier link.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { TOPICS, type Topic } from '../mail/types.js';

export function signUnsubscribe(secret: string, uid: string, topic: Topic): string {
  return createHmac('sha256', secret).update(`${uid}:${topic}`).digest('base64url');
}

export function isTopic(value: unknown): value is Topic {
  return typeof value === 'string' && (TOPICS as readonly string[]).includes(value);
}

/** True when sig is the signature for uid and topic. Constant-time compare. */
export function verifyUnsubscribe(secret: string, uid: string, topic: string, sig: string): boolean {
  if (!secret || !uid || !isTopic(topic) || !sig) return false;
  const expected = Buffer.from(signUnsubscribe(secret, uid, topic));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function unsubscribeUrl(siteUrl: string, secret: string, uid: string, topic: Topic): string {
  const params = new URLSearchParams({ u: uid, t: topic, s: signUnsubscribe(secret, uid, topic) });
  return `${siteUrl}/unsubscribe?${params.toString()}`;
}
