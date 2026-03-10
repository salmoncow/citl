# Firestore Schema Reference

Last updated: 2026-03-10

---

## Overview

CITL uses a single Firebase project (`citl-baed2`). All application data lives in
Firestore. This document is the canonical reference for collection/document structure,
field types, access patterns, and key operational patterns.

**Data access layer:**

| Layer | File | Responsibility |
|-------|------|---------------|
| Repository | `src/repositories/score-repository.ts` | Raw Firestore ops; returns `Result<T>`; no business logic |
| Service | `src/services/score-service.ts` | Validation + business logic; 1-hr cache (5-min for latest week) |

Cache is invalidated on every write. No exceptions are thrown across module boundaries.

---

## Collections

### `announcements/{docId}`

Auto-ID via `addDoc`.

| Field | Type | Notes |
|-------|------|-------|
| `year` | `number` | Season year (e.g. `2025`) |
| `title` | `string` | Announcement headline |
| `body` | `string` | Announcement body text |
| `postedAt` | `Timestamp` | Firestore server timestamp |
| `lastEditedAt` | `Timestamp \| null` | Set on edits; null on initial post |

**Access:** Read — public. Write — admin only.

**Query:** `where('year', '==', year)` ordered by `postedAt desc`.
Requires a composite index: `year` (Asc) + `postedAt` (Desc).

**TypeScript interface:** `Announcement` — `src/types/announcement.ts`

---

### `seasons/{year}`

Document ID: string year (e.g. `"2025"`).

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Same as document ID |
| `year` | `number` | Season year |
| `status` | `'active' \| 'complete'` | |
| `currentWeek` | `number` | 1–15; reflects last published week |
| `standings` | `SeasonStandings[]` | Denormalized array — see note below |
| `awards` | `SeasonAwards \| null` | End-of-season awards; null mid-season |
| `weekDateOverrides` | `Partial<Record<string, string \| null>>` | Optional; overrides computed shoot dates per week number |

**Denormalized standings:** The `standings` array is written on every publish so the
home page can read a single document instead of aggregating across all week docs. This
is an intentional O(1) read trade-off; keep it in sync on every publish.

**Access:** Read — public. Write — admin only.

**TypeScript interfaces:** `Season`, `SeasonAwards`, `SeasonStandings`, `ComputedAwards` — `src/types/season.ts`

---

### `seasons/{year}/teams/{teamId}`

Document ID: slugified team name — lowercase, hyphens (e.g. `crazy-guns`).

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Same as document ID |
| `name` | `string` | Display name |
| `captain` | `string` | May be empty string at creation time |
| `shooters` | `Shooter[]` | See sub-type below |
| `totals` | `TeamTotals` | See sub-type below |

**`Shooter`**

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | |
| `name` | `string` | |
| `rookie` | `boolean` | |
| `startingAvg` | `number` | Going-in baseline; default 35 |
| `finalAvg` | `number \| null` | Set at season close |
| `weeksShot` | `number \| null` | Populated after first score entry |
| `scores` | `(number \| null)[]` | 15-element parallel array; index 0 = W1, index 14 = W15 |

**`TeamTotals`**

| Field | Type | Notes |
|-------|------|-------|
| `targets` | `number[]` | 15-element parallel array |
| `rankPoints` | `number[]` | 15-element parallel array |
| `bonusPoints` | `number[]` | 15-element parallel array |

**Access:** Read — public. Write — admin only.

**TypeScript interfaces:** `Shooter` — `src/types/shooter.ts`; `Team`, `TeamTotals` — `src/types/score.ts`

---

### `seasons/{year}/weeks/{weekNumber}`

Document ID: string week number (e.g. `"1"`, `"15"`).

| Field | Type | Notes |
|-------|------|-------|
| `weekNumber` | `number` | 1–15 |
| `publishedAt` | `string` | ISO 8601 timestamp |
| `teamResults` | `TeamResult[]` | See sub-type below |
| `accolades` | `Accolade[]` | Optional; omitted if none |

**`TeamResult`**

| Field | Type | Notes |
|-------|------|-------|
| `teamId` | `string` | Matches `teams/{teamId}` document ID |
| `teamName` | `string` | Denormalized display name |
| `targets` | `number` | Team target total for the week |
| `rankPoints` | `number` | Rank points awarded |
| `bonusPoints` | `number` | Bonus points awarded |
| `shooterScores` | `ShooterScore[]` | See sub-type below |

**`ShooterScore`**

| Field | Type | Notes |
|-------|------|-------|
| `name` | `string` | |
| `score1` | `number \| null` | First round; null in historical imports |
| `score2` | `number \| null` | Second round; null in historical imports |
| `total` | `number` | Authoritative score used for all calculations |

**`Accolade`**

| Field | Type | Notes |
|-------|------|-------|
| `shooterName` | `string` | |
| `teamName` | `string` | |
| `streak` | `number` | Consecutive-week streak count |

**Access:** Read — public. Write — admin only.

**TypeScript interfaces:** `WeekResult`, `TeamResult`, `ShooterScore` — `src/types/score.ts`; `Accolade` — `src/types/shooter.ts`

---

### `seasons/{year}/entries/{entryId}`

Document ID: `"{weekNumber}_{teamId}"` (e.g. `"1_crazy-guns"`).

Admin audit trail written when an admin saves scores before publishing. May be
overwritten any number of times before the week is published.

| Field | Type | Notes |
|-------|------|-------|
| `year` | `number` | |
| `weekNumber` | `number` | |
| `teamId` | `string` | |
| `teamName` | `string` | Denormalized display name |
| `savedAt` | `string` | ISO 8601 timestamp of last save |
| `shooters` | `ShooterScore[]` | Same shape as `weeks/{n}.teamResults[].shooterScores` |

**Access:** Read — admin only. Write — admin only.

**Composite ID rationale:** `"{weekNumber}_{teamId}"` enables batch deletion and range
queries by week number (`weekNumber <= maxWeekNumber`) without a composite index.

**Composite index needed:** `weekNumber` (Asc) for range queries on entry pre-fetch.

**TypeScript interface:** `SeasonEntry` — `src/types/score.ts`

---

## Key Patterns

### Parallel arrays

`Shooter.scores` and all three `TeamTotals` fields (`targets`, `rankPoints`,
`bonusPoints`) are fixed-length 15-element arrays. Index 0 = W1, index 14 = W15.
This avoids sub-collection overhead for per-week shooter data and simplifies
cumulative aggregation.

### Composite entry IDs

Entry document IDs follow the pattern `"{weekNumber}_{teamId}"`. This allows the
repository to construct any entry's document reference directly from known fields
(no query needed) and supports batch deletion of all entries for a team by
constructing the 15 possible IDs (`1_{teamId}` through `15_{teamId}`).

### Denormalized standings

`seasons/{year}.standings` is rewritten on every publish. Home page reads a single
document to render the full standings table. Any operation that changes the scoring
outcome (publish, delete team, manual override) must also update this array.

### Cascading operations

**Team deletion** (2 batches):
1. Delete `teams/{teamId}` document + all 15 `entries/{n}_{teamId}` documents.
2. Filter `teamId` from `teamResults` in every `weeks/{n}` document and from the
   `standings` array in the `seasons/{year}` document.

**Team rename:**
Update `teamName` in all matching `entries` documents, all `weeks/{n}.teamResults`
entries, and any `accolades` entries that reference the team.

**Shooter removal:**
Filter the shooter from `team.shooters`, from all `entries/{n}.shooters` arrays,
and from `accolades` in any published week.

---

## Composite Indexes Required

| Collection | Fields | Direction |
|------------|--------|-----------|
| `announcements` | `year`, `postedAt` | Asc, Desc |
| `seasons/{year}/entries` | `weekNumber` | Asc (range query) |

All other queries use single-field indexes or direct document-ID lookups and require
no additional index configuration.

---

## TypeScript Type Locations

| Interface | File |
|-----------|------|
| `Shooter`, `Accolade` | `src/types/shooter.ts` |
| `Team`, `TeamTotals`, `ShooterScore`, `TeamResult`, `WeekResult`, `SeasonEntry`, `StandingRow` | `src/types/score.ts` |
| `Season`, `SeasonAwards`, `SeasonStandings`, `ComputedAwards` | `src/types/season.ts` |
| `ScorecardShooter` (display layer only) | `src/types/scorecard.ts` |
| `Announcement` | `src/types/announcement.ts` |
