export interface YardageRow {
  min: number;   // inclusive
  max: number;   // inclusive
  yards: number;
}

/**
 * Lookup table mapping the sum of all 5 shooters' going-in averages
 * to the team's starting yardage for the evening.
 * To update yardage rules, edit only this constant.
 */
export const YARDAGE_TABLE: readonly YardageRow[] = [
  { min:   0.00, max: 175.49, yards: 16 },
  { min: 175.50, max: 185.49, yards: 17 },
  { min: 185.50, max: 187.49, yards: 18 },
  { min: 187.50, max: 189.49, yards: 19 },
  { min: 189.50, max: 191.49, yards: 20 },
  { min: 191.50, max: 193.49, yards: 21 },
  { min: 193.50, max: 196.49, yards: 22 },
  { min: 196.50, max: 201.49, yards: 23 },
  { min: 201.50, max: 207.49, yards: 24 },
  { min: 207.50, max: 211.49, yards: 25 },
  { min: 211.50, max: 215.49, yards: 26 },
  { min: 215.50, max: 250.00, yards: 27 },
];
