/**
 * Build-time feature switches.
 *
 * League requests (spec 009) ship hidden in production until the M3
 * review queue deploys: VITE_LEAGUE_REQUESTS=true turns them on, =false
 * turns them off, and unset means on only against the emulators.
 */

const leagueFlag = import.meta.env['VITE_LEAGUE_REQUESTS'];

export const leagueRequestsEnabled =
  leagueFlag === 'true' || (leagueFlag !== 'false' && import.meta.env['VITE_USE_EMULATOR'] === 'true');
