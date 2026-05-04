/**
 * Vitest setup file for function tests. Runs BEFORE any test file imports
 * so environment variables are in place before the function module is
 * loaded (and captures `enforceAppCheck: !isEmulator` correctly).
 */

process.env['FUNCTIONS_EMULATOR'] = 'true';
process.env['GCLOUD_PROJECT'] ??= 'citl-fn-test';
process.env['FIREBASE_AUTH_EMULATOR_HOST'] ??= '127.0.0.1:9099';
process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';
