/**
 * Cloud Functions client wrapper.
 *
 * Lazy-init: getFunctions runs once on first callable invocation.
 * Emulator-aware: when VITE_USE_EMULATOR=true, callable invocations
 * go to the functions emulator at 127.0.0.1:5001 instead of the live
 * us-central1 deployment.
 */

import { getApp } from 'firebase/app';
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
  type Functions,
  type HttpsCallable,
} from 'firebase/functions';
import { useEmulator } from '@/firebase-config';

const REGION = 'us-central1';

let _functions: Functions | null = null;

function getFunctionsInstance(): Functions {
  if (_functions) return _functions;
  _functions = getFunctions(getApp(), REGION);
  if (useEmulator) {
    connectFunctionsEmulator(_functions, '127.0.0.1', 5001);
  }
  return _functions;
}

/**
 * Wrap a callable Cloud Function by name. Caller-supplied generics
 * type the request and response payloads.
 */
export function callable<TIn = unknown, TOut = unknown>(name: string): HttpsCallable<TIn, TOut> {
  return httpsCallable<TIn, TOut>(getFunctionsInstance(), name);
}
