/**
 * Pure email rendering (spec 011 AC-10): a plain-text part and a
 * single-column HTML part with escaped content, one link, and a footer.
 * No images, tracking pixels, or external CSS. Builders for each kind of
 * message return MailContent; renderMail adds the recipient's footer.
 */

import { SITE_URL } from './config.js';
import { TOPIC_LABELS, type MailContent, type Topic } from './types.js';

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}

/** Topic mail carries an unsubscribe link (AC-4); other mail links to /account (AC-6). */
export type Footer =
  | { kind: 'topic'; topic: Topic; unsubscribeUrl: string }
  | { kind: 'account' };

const ACCOUNT_URL = `${SITE_URL}/#/account`;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function footerLines(footer: Footer): string[] {
  if (footer.kind === 'topic') {
    return [
      `You get this because you subscribed to ${TOPIC_LABELS[footer.topic]} on citl.club.`,
      `Unsubscribe: ${footer.unsubscribeUrl}`,
      `Email settings: ${ACCOUNT_URL}`,
    ];
  }
  return [
    'You get this because of a request on your citl.club account.',
    `Email settings: ${ACCOUNT_URL}`,
  ];
}

function footerHtml(footer: Footer): string {
  const settings = `<a href="${escapeHtml(ACCOUNT_URL)}">Email settings</a>`;
  if (footer.kind === 'topic') {
    return `You get this because you subscribed to ${escapeHtml(TOPIC_LABELS[footer.topic])} on citl.club.<br>`
      + `<a href="${escapeHtml(footer.unsubscribeUrl)}">Unsubscribe from ${escapeHtml(TOPIC_LABELS[footer.topic])}</a> · ${settings}`;
  }
  return `You get this because of a request on your citl.club account.<br>${settings}`;
}

export function renderMail(content: MailContent, footer: Footer): RenderedMail {
  const linkUrl = content.link ? `${SITE_URL}${content.link.path}` : null;

  const text = [
    ...content.paragraphs,
    ...(content.link && linkUrl ? [`${content.link.label}: ${linkUrl}`] : []),
    '--',
    ...footerLines(footer),
  ].join('\n\n');

  const body = content.paragraphs
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
  const cta = content.link && linkUrl
    ? `<p style="margin:0 0 24px"><a href="${escapeHtml(linkUrl)}">${escapeHtml(content.link.label)}</a></p>`
    : '';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5">
<div style="max-width:560px;margin:0 auto">
<p style="margin:0 0 16px;font-size:14px;font-weight:bold;letter-spacing:0.04em;text-transform:uppercase">Central Illinois Trap League</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escapeHtml(content.subject)}</h1>
${body}
${cta}
<hr style="border:none;border-top:1px solid #999;margin:24px 0 12px">
<p style="margin:0;font-size:13px">${footerHtml(footer)}</p>
</div>
</body></html>`;

  return { subject: content.subject, text, html };
}
