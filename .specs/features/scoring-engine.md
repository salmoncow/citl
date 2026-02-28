# Feature: Scoring Engine

## Overview

The CITL scoring engine is a **pure computation service** (`src/services/scoring-engine.js`)
that implements all trap league score calculations: averages, bonus points, rank points,
and season awards. All functions are authoritative — the engine is the single source of
truth for computed values.

All functions are pure: no I/O, no side effects, no framework dependencies.
The CSV parser (`src/utils/csv-parser.js`) is a separate unit that converts
`inputs.csv` → `SeasonData`; the engine then computes all derived values from that.

**ADR reference**: ADR-006 in `.prompts/meta/architectural-decision-log.md`

---

## Business Rules

### Average Computation

**Starting average (W0):**
- Returning shooter: prior season final average
- New/rookie shooter: 35.0

**Shooter current average (through a given week):**
- `weeksShot` = count of non-null scores from W1 through current week
- If `weeksShot < 2`: `mean([startingAvg, ...actualScores])` — include W0
- If `weeksShot >= 2`: `mean([...actualScores])` — W0 phased out

**Going-in average (before a given week):**
- Same formula, but only considering scores through W(weekIndex-1)
- Used for bonus points and rank points calculations

### Dummy Shooters

Teams may field up to 2 dummies when they cannot fill a full squad.

- **Identification**: `name.toUpperCase().includes('DUMMY')`
- **Dummy going-in average**: mean of the real shooters' going-in averages for that week
- **Dummy score in CSV**: present when fielded (their actual score column value is non-null)
- **Dummies excluded from**: season awards, highest average, rookie of year, most improved

### Bonus Points (per team, per week)

**Target component:** +5 if the team's total targets this week exceed the "going-in sum".

**Going-in sum** = sum of each shooter's going-in average *before* this week:
- Real shooters who shot: `computeGoingInAverage(startingAvg, scores, weekIndex)`
- Dummies who shot: going-in avg = mean of real shooters' going-in avgs this week
- Only includes shooters who actually shot this week (non-null score)

**Rookie component:** +1 per rookie whose going-in average for this week is < 35.

Rules:
- Shooter must have a non-null score for that week (must have shot)
- Maximum 2 points per team per week
- **Not awarded for weeks 11–15** (weekIndex 10–14; weeks are 1-indexed W1–W15)
- Dummies excluded; only `rookie === true` shooters

**Total:** `bonusPoints = targetComponent + rookieComponent`

Stored as `null` if both components are zero/null. Otherwise stored as the integer sum.

Examples:
- targetComponent=5, rookieComponent=0 → bonusPoints=5
- targetComponent=null, rookieComponent=1 → bonusPoints=1
- targetComponent=5, rookieComponent=2 → bonusPoints=7
- targetComponent=null, rookieComponent=0 → bonusPoints=null

### Rank Points (cross-team, per week)

Teams ranked by that week's total targets, descending.

**Scale**: Rank 1 = 30, Rank 2 = 28, Rank 3 = 26 … (−2 per rank)

**Ties**: all tied teams receive the **mean** of the points they would have shared.

Tie examples:
- 2 teams tied for Rank 1 → each gets `(30 + 28) / 2 = 29`
- 3 teams tied for Rank 1 → each gets `(30 + 28 + 26) / 3 = 28`
- 2 teams tied for Rank 6 → each gets `(20 + 18) / 2 = 19`

Teams that did not participate receive `null` rank points.
Forfeit teams (targets = 0 but participated) rank last (e.g., Rank 8 in an 8-team league = 16 pts).

### Season Awards (min 6 weeks shot; excludes dummies)

**Highest Average:**
- Per team: `max(finalAvg)` among shooters with weeksShot ≥ 6
- Season winner: `max` across all teams

**Rookie of the Year (same algorithm, rookies only):**
- Per team: `max(finalAvg)` among `rookie === true` shooters with weeksShot ≥ 6
- Season winner: `max` across all teams

**Most Improved:**
- Score formula: `100 × (finalAvg − startingAvg) / (50 − startingAvg)`
- Per team: `max(improvementScore)` among shooters with weeksShot ≥ 6
- Season winner: `max` across all teams

---

## Data Contracts

### Inputs — SeasonData (from csv-parser or localStorage)

```
SeasonData {
  season: number                 // e.g. 2025
  teams: Team[] {
    name: string
    shooters: Shooter[] {
      name: string
      rookie: boolean
      isDummy: boolean           // derived from name.toUpperCase().includes('DUMMY')
      startingAvg: number        // W0
      scores: (number|null)[]   // W1–W15, 15 elements; null = did not shoot
      weeksShot: number|null    // null = never shot
      finalAvg: number
    }
    totals: TeamTotals {         // null arrays on input; populated by engine
      targets:     (number|null)[]   // 15 elements
      rankPoints:  (number|null)[]   // 15 elements
      bonusPoints: (number|null)[]   // 15 elements
    }
  }
}
```

### Outputs — computeSeasonTotals

Returns a new `SeasonData` with `totals` populated.

- `targets[wi]`: sum of all non-null scores for that team/week; `null` if no shooter participated
- `rankPoints[wi]`: rank points (may be non-integer for ties); `null` if team did not participate
- `bonusPoints[wi]`: target component + rookie component; `null` if no bonus was earned

### Outputs — computeSeasonAwards

Returns a partial `SeasonAwards` with shooter-based awards only.
Team standings awards (`firstPlaceTeam`, etc.) are computed separately
from cumulative rank+bonus totals and are returned as `null`.

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Team forfeit (no shooter scored) | targets=null stored; 0 used for rank (ranks last); no bonus |
| Shooter appears on two teams (sub) | Treated as independent records per team |
| All dummies, no real shooters shot | goingInAverageSum = 0; dummyGoingInAvg = 0 |
| weeksShot = 0 | finalAvg = startingAvg; no season award eligibility |
| Rookie startingAvg = 35 exactly | 35 < 35 is false → no rookie bonus on W1 |
| weekIndex >= 10 | rookieBonus always 0 |
| Tie for all positions | Mean formula applies at every rank |

---

## Validation

Compare `computeSeasonTotals(parseSeasonCsv(csvText, year))` against `src/data/scorecards/{year}.json`.

Paste in the browser console at `localhost:3000` after `npm run dev`:

```javascript
const { parseSeasonCsv } = await import('/utils/csv-parser.js');
const { computeSeasonTotals } = await import('/services/scoring-engine.js');

async function validate(year) {
  const csvText = await fetch(`/${year}-inputs.csv`).then(r => r.text());
  const expected = await fetch(`/data/scorecards/${year}.json`).then(r => r.json());

  const parsed = parseSeasonCsv(csvText, year);
  const computed = computeSeasonTotals(parsed);

  let errors = 0;
  computed.teams.forEach((team, ti) => {
    const exp = expected.teams[ti];
    if (!exp) { console.warn(`[${year}] No expected team at index ${ti}`); return; }

    team.totals.targets.forEach((val, wi) => {
      const e = exp.totals.targets[wi];
      const ok = val === e || (val === 0 && e === null) || (val === null && e === null);
      if (!ok) { console.error(`[${year}][${team.name}] W${wi+1} targets: got ${val}, expected ${e}`); errors++; }
    });
    team.totals.rankPoints.forEach((val, wi) => {
      const e = exp.totals.rankPoints[wi];
      if (val !== e) { console.error(`[${year}][${team.name}] W${wi+1} rankPoints: got ${val}, expected ${e}`); errors++; }
    });
    team.totals.bonusPoints.forEach((val, wi) => {
      const e = exp.totals.bonusPoints[wi];
      if (val !== e) { console.error(`[${year}][${team.name}] W${wi+1} bonusPoints: got ${val}, expected ${e}`); errors++; }
    });
  });

  console.log(errors === 0
    ? `✓ [${year}] All totals match ${year}.json`
    : `✗ [${year}] ${errors} mismatches found`);
}

await validate(2023);
await validate(2024);
await validate(2025);
```

---

## SOLID Compliance

- `scoring-engine.js`: no imports from repository/service/view layers (pure functions only)
- `localstorage-score-repository.js`: no business logic; does not call engine
- `repository-factory.js`: adding localStorage backend does not touch existing backends
- Views/services: depend on repository interface, not concrete class
