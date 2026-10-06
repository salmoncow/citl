/**
 * unsubscribe — signed one-click unsubscribe (spec 011 AC-5, DD-5),
 * served at https://citl.club/unsubscribe through a hosting rewrite.
 *
 * GET  ?u&t&s  → a confirm page with a POST button (mail scanners follow
 *               links, so GET never changes anything)
 * POST ?u&t&s  → sets notificationSettings/{u}.topics.{t} = false and
 *               shows a confirmation; also serves RFC 8058 one-click
 *               (List-Unsubscribe-Post) from mail clients.
 * A bad signature is 400 and writes nothing; other methods are 405.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { SITE_URL, UNSUBSCRIBE_SECRET } from './mail/config.js';
import { escapeHtml } from './mail/templates.js';
import { TOPIC_LABELS, type Topic } from './mail/types.js';
import { verifyUnsubscribe } from './lib/unsubscribeToken.js';

if (getApps().length === 0) {
  initializeApp();
}

export interface UnsubscribeRequest {
  method: string;
  query: Record<string, unknown>;
}

export interface UnsubscribeResponse {
  status: number;
  html: string;
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · CITL</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;line-height:1.5">
<h1 style="font-size:22px">${escapeHtml(title)}</h1>
${body}
</body></html>`;
}

const first = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? '') : typeof v === 'string' ? v : '');

export async function handleUnsubscribe(req: UnsubscribeRequest): Promise<UnsubscribeResponse> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return { status: 405, html: page('Not allowed', '<p>Use the link in your email.</p>') };
  }
  const uid = first(req.query['u']);
  const topic = first(req.query['t']);
  const sig = first(req.query['s']);
  if (!verifyUnsubscribe(UNSUBSCRIBE_SECRET.value(), uid, topic, sig)) {
    return {
      status: 400,
      html: page('Link not valid', `<p>This unsubscribe link is incomplete or changed. Manage your email on <a href="${SITE_URL}/#/account">your account page</a>.</p>`),
    };
  }
  const label = escapeHtml(TOPIC_LABELS[topic as Topic]);

  if (req.method === 'GET') {
    const action = `/unsubscribe?${new URLSearchParams({ u: uid, t: topic, s: sig }).toString()}`;
    return {
      status: 200,
      html: page(`Unsubscribe from ${TOPIC_LABELS[topic as Topic]}?`,
        `<p>You'll stop getting ${label} emails from the Central Illinois Trap League.</p>
<form method="post" action="${escapeHtml(action)}"><button type="submit" style="font-size:16px;padding:8px 16px">Unsubscribe</button></form>`),
    };
  }

  const db = getFirestore();
  // A deleted account has nothing to unsubscribe; don't recreate its settings.
  if ((await db.doc(`users/${uid}`).get()).exists) {
    await db.doc(`notificationSettings/${uid}`).set(
      { topics: { [topic]: false }, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
  return {
    status: 200,
    html: page('Unsubscribed',
      `<p>You won't get ${label} emails any more. Change this any time on <a href="${SITE_URL}/#/account">your account page</a>.</p>`),
  };
}

export const unsubscribe = onRequest(
  { region: 'us-central1', secrets: [UNSUBSCRIBE_SECRET], maxInstances: 2 },
  async (req, res) => {
    const out = await handleUnsubscribe({ method: req.method, query: req.query as Record<string, unknown> });
    res.status(out.status).set('Content-Type', 'text/html; charset=utf-8').set('Cache-Control', 'no-store').send(out.html);
  },
);
