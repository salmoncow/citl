import { describe, it, expect } from 'vitest';
import { LEAGUE_EMAIL, leagueMailto } from './contact';

describe('leagueMailto', () => {
  it('links to the league address', () => {
    expect(leagueMailto()).toBe(`mailto:${LEAGUE_EMAIL}`);
  });

  it('encodes an optional subject', () => {
    expect(leagueMailto('CITL enrollment')).toBe('mailto:lmckenna.citl@gmail.com?subject=CITL%20enrollment');
  });
});
