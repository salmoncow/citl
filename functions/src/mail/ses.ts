/**
 * The only code that talks to SES (spec 011 DD-3, DD-8). Credentials come
 * from STS AssumeRoleWithWebIdentity with a Google-signed ID token for the
 * function's service account; no AWS key exists. In the emulator, and in
 * tests that install a fake, nothing reaches AWS.
 */

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { fromWebToken } from '@aws-sdk/credential-providers';
import { logger } from 'firebase-functions/v2';
import { CONFIGURATION_SET, FROM, REPLY_TO, SES_REGION, SES_ROLE_ARN, TOKEN_AUDIENCE } from './config.js';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Extra headers (List-Unsubscribe for topic mail). */
  headers?: Record<string, string>;
}

export interface MailTransport {
  send(mail: OutgoingMail): Promise<void>;
}

/** A send failure the event retry may fix (throttling, SES 5xx, network). */
export class RetryableMailError extends Error {}

const METADATA_IDENTITY_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';

async function googleIdToken(): Promise<string> {
  const url = `${METADATA_IDENTITY_URL}?audience=${encodeURIComponent(TOKEN_AUDIENCE)}&format=full`;
  const res = await fetch(url, { headers: { 'Metadata-Flavor': 'Google' } });
  if (!res.ok) throw new RetryableMailError(`metadata identity token: HTTP ${res.status}`);
  return res.text();
}

let client: SESv2Client | null = null;

function sesClient(): SESv2Client {
  if (!client) {
    client = new SESv2Client({
      region: SES_REGION,
      // The client memoizes these until shortly before they expire (1 hour).
      credentials: async () => fromWebToken({
        roleArn: SES_ROLE_ARN.value(),
        webIdentityToken: await googleIdToken(),
        roleSessionName: 'citl-sendMail',
        durationSeconds: 3600,
        clientConfig: { region: SES_REGION },
      })(),
    });
  }
  return client;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof RetryableMailError) return true;
  const e = err as { name?: string; $retryable?: unknown; $metadata?: { httpStatusCode?: number } } | null;
  const status = e?.$metadata?.httpStatusCode;
  return Boolean(e?.$retryable)
    || e?.name === 'TooManyRequestsException'
    || e?.name === 'ThrottlingException'
    || (typeof status === 'number' && status >= 500)
    || status === undefined; // network failure before any response
}

const sesTransport: MailTransport = {
  async send(mail) {
    try {
      await sesClient().send(new SendEmailCommand({
        FromEmailAddress: FROM,
        ReplyToAddresses: [REPLY_TO],
        Destination: { ToAddresses: [mail.to] },
        ConfigurationSetName: CONFIGURATION_SET,
        Content: {
          Simple: {
            Subject: { Data: mail.subject, Charset: 'UTF-8' },
            Body: {
              Text: { Data: mail.text, Charset: 'UTF-8' },
              Html: { Data: mail.html, Charset: 'UTF-8' },
            },
            Headers: Object.entries(mail.headers ?? {}).map(([Name, Value]) => ({ Name, Value })),
          },
        },
      }));
    } catch (err) {
      if (isRetryable(err)) throw new RetryableMailError(String((err as Error)?.message ?? err));
      throw err;
    }
  },
};

/** Emulator transport: logs instead of sending (AC-9). */
const logTransport: MailTransport = {
  async send(mail) {
    logger.info('sendMail (emulator): not sent', { to: mail.to, subject: mail.subject, headers: mail.headers, text: mail.text });
  },
};

let override: MailTransport | null = null;

/** Tests install a fake transport; pass null to restore the default. */
export function setTransportForTests(transport: MailTransport | null): void {
  override = transport;
}

export function transport(): MailTransport {
  if (override) return override;
  return process.env['FUNCTIONS_EMULATOR'] === 'true' ? logTransport : sesTransport;
}
