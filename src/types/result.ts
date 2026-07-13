/**
 * @file Result type + helpers — the cross-layer success/failure contract.
 *
 * Repositories and services return Result instead of throwing across
 * module boundaries (constitution §III.2). Lives in types/ so modules
 * can import the contract without depending on a concrete repository.
 */

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };

export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

export function failure(error: string, code = 'UNKNOWN_ERROR'): Result<never> {
  return { success: false, error, code };
}
