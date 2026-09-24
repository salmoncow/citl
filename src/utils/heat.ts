/**
 * Heat-grid bin for a shooter's night (targets of 50) — spec 006 DD-5.
 * Five sequential bins: ≤39, 40–42, 43–45, 46–48, 49–50. The number is
 * always printed in the cell, so colour is never the only signal.
 */
export type HeatBin = 1 | 2 | 3 | 4 | 5;

export function heatBin(score: number): HeatBin {
  if (score <= 39) return 1;
  if (score <= 42) return 2;
  if (score <= 45) return 3;
  if (score <= 48) return 4;
  return 5;
}

export const HEAT_LEGEND: { bin: HeatBin; label: string }[] = [
  { bin: 1, label: '≤39' },
  { bin: 2, label: '40–42' },
  { bin: 3, label: '43–45' },
  { bin: 4, label: '46–48' },
  { bin: 5, label: '49–50' },
];
