/** League contact address (League Coordinator / site admin). */
export const LEAGUE_EMAIL = 'lmckenna.citl@gmail.com';

/** `mailto:` href for the league address, with an optional subject line. */
export function leagueMailto(subject?: string): string {
  return subject ? `mailto:${LEAGUE_EMAIL}?subject=${encodeURIComponent(subject)}` : `mailto:${LEAGUE_EMAIL}`;
}
