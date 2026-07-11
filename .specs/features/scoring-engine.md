# Feature: Scoring Engine

**Status:** Implemented (`src/services/scoring-engine.ts`)

## Overview

The CITL scoring engine is a **pure computation service** (`src/services/scoring-engine.ts`)
that implements all trap league score calculations: averages, bonus points, rank points,
and season awards. All functions are authoritative — the engine is the single source of
truth for computed values.

All functions are pure: no I/O, no side effects, no framework dependencies. The engine
consumes a `SeasonData` structure assembled by `src/services/score-service.ts` from
Firestore (there is no CSV parser; historical scorecards were migrated into Firestore per
ADR-010), then computes all derived values from it.

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
- **Naming convention**: last word of team name + `DUMMY1` / `DUMMY2` (no space before number).
  Example: "Full Choke Artists" → "Artists DUMMY1", "Artists DUMMY2"
- **Max-2 constraint**: a team may have at most 2 dummy shooters per week. This is enforced
  at publish time in `score-service.ts` `publishWeek()`, which returns a `VALIDATION_ERROR`
  if any entry for the published week contains more than 2 shooters matching the DUMMY pattern.
- **Dummy going-in average**: mean of the real shooters' going-in averages for that week
- **W0 display**: going-in average shown in scorecard W0 column = mean of the actual
  W1 scores (scores[0]) of real teammates who shot W1, rounded to 1 decimal.
  Falls back to `-` when no W1 participants have a non-null score (pre-migration
  seasons or season not yet started).
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

A team is included in the ranking whenever it has a numeric target total for the week —
**including a no-show/forfeit team recorded with `0` targets**, which sorts last and receives
last-place rank points (e.g., the trailing team in a 2-team week gets Rank 2 = 28; Rank 8 in
an 8-team week = 16 pts). `null` rank points are assigned **only** to teams with `null`
targets — i.e. no entry at all for that week (`computeRankPoints` excludes them from the
sort). This matches the shipped engine (`computeRankPoints`, `scoring-engine.ts`) and its
tests (`scoring-engine.test.ts` — "no-show team in W2, 0 targets → rank 2 = 28").

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

### Inputs — SeasonData (from Firestore)

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

## SOLID Compliance

- `scoring-engine.ts`: no imports from repository/service/view layers (pure functions only)
- `repository-factory.ts`: constructs repositories behind an interface; consumers depend on the interface, not the concrete class
- Views/services: depend on repository interface, not concrete class
