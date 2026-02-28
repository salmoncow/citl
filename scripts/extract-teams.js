#!/usr/bin/env node
/**
 * extract-teams.js
 *
 * Reads src/data/scorecards/{year}.json for 2023–2025 and writes
 * src/data/teams/teams.json with the Firestore-ready data model.
 *
 * Usage: npm run extract-teams
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const YEARS = [2023, 2024, 2025];
const INPUT_DIR = join(ROOT, 'src', 'data', 'scorecards');
const OUTPUT_DIR = join(ROOT, 'src', 'data', 'teams');
const OUTPUT_FILE = join(OUTPUT_DIR, 'teams.json');

const slugify = (name) => name.trim().toLowerCase().replace(/\s+/g, '-');

const seasons = {};

for (const year of YEARS) {
  const inputPath = join(INPUT_DIR, `${year}.json`);
  let scorecard;
  try {
    scorecard = JSON.parse(readFileSync(inputPath, 'utf8'));
  } catch (err) {
    console.warn(`Warning: could not read ${inputPath}: ${err.message}`);
    continue;
  }

  seasons[year] = scorecard.teams.map((team) => ({
    id: slugify(team.name),
    name: team.name,
    shooters: team.shooters
      .filter((s) => !s.name.toUpperCase().includes('DUMMY'))
      .map((s) => ({
        name: s.name,
        rookie: s.rookie,
        startingAvg: s.startingAvg,
      })),
  }));

  console.log(`${year}: ${seasons[year].length} teams`);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT_FILE, JSON.stringify({ seasons }, null, 2) + '\n', 'utf8');
console.log(`Written: ${OUTPUT_FILE}`);
