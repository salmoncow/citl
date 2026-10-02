/**
 * Account context — hands the page-lifetime AuthModule and AccountGate
 * (built once in main.ts) to the lazily-loaded account components, so
 * they reuse the single users/{uid} listener instead of opening their
 * own (spec 008 AC-23).
 */

import type { AuthModule } from '@/modules/auth';
import type { AccountGate } from '@/modules/account-gate';

export interface AccountContext {
  auth: AuthModule;
  gate: AccountGate;
}

let context: AccountContext | null = null;

export function setAccountContext(value: AccountContext): void {
  context = value;
}

export function getAccountContext(): AccountContext {
  if (!context) throw new Error('Account context used before main.ts initialized it.');
  return context;
}
