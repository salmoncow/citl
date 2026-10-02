/**
 * Cheap, dependency-free check for a Firebase email sign-in link
 * (spec 008 DD-4). main.ts runs this at boot on every page load, so it
 * must not import firebase/auth; the real email-link code is loaded with
 * a dynamic import only when this matches.
 *
 * Firebase appends `mode=signIn&oobCode=…&apiKey=…` as query parameters
 * to the continue URL (the origin root).
 */
export function looksLikeEmailLink(url: string): boolean {
  // Only the real query string counts; a "?" inside the hash fragment
  // is not where Firebase puts the code.
  const beforeHash = url.split('#')[0] ?? '';
  const q = beforeHash.indexOf('?');
  if (q < 0) return false;
  const query = beforeHash.slice(q + 1);
  const params = new URLSearchParams(query);
  return params.get('mode') === 'signIn' && params.has('oobCode');
}
