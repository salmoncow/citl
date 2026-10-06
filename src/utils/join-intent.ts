/**
 * Join intent (spec 012 AC-4): remembers that sign-in started on #/join,
 * so an email sign-in link opened soon after returns there instead of
 * /account. A timestamp in localStorage; storage errors are ignored.
 */

export const JOIN_INTENT_KEY = 'citl.joinIntent';
export const JOIN_INTENT_TTL_MS = 60 * 60 * 1000;

export function markJoinIntent(now: number = Date.now()): void {
  try {
    localStorage.setItem(JOIN_INTENT_KEY, String(now));
  } catch {
    // Storage unavailable: the link lands on /account as before.
  }
}

export function hasFreshJoinIntent(now: number = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(JOIN_INTENT_KEY));
    return Number.isFinite(at) && at > 0 && now - at >= 0 && now - at <= JOIN_INTENT_TTL_MS;
  } catch {
    return false;
  }
}

export function clearJoinIntent(): void {
  try {
    localStorage.removeItem(JOIN_INTENT_KEY);
  } catch {
    // ignore
  }
}
