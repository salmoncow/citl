# Domain Knowledge Index

Living references for the league's business rules. Files here are **never archived** —
they are maintained in place whenever a feature changes the rules ("reference, don't
reproduce": each rule has exactly one canonical home; everything else links to it).

## Where each piece of domain knowledge lives

| Domain area | Canonical home | Notes |
|---|---|---|
| **Scoring rules** — averages, dummies, bonus points, rank points, standings order, season awards, edge cases | [scoring-rules.md](./scoring-rules.md) | The `@scoring` agent's authoritative source; implemented by `src/services/scoring-engine.ts` |
| **Season calendar** — practice day (2nd Tuesday of April), Week 1 (3rd Tuesday), 15 shoot weeks, July-4 skip rule | Header comment of `src/utils/schedule.ts` | Deliberately documented at the implementation (pure, heavily tested); no separate doc — do not duplicate it here |
| **Handicap yardage** — sum of the 5 shooters' going-in averages → starting yardage | `YARDAGE_TABLE` in `src/utils/yardage.ts` | The table *is* the rule; "to update yardage rules, edit only this constant" |
| **Member-facing rules text** — the public Rules page at citl.club/#/rules | `src/views/rules.ts` | **Derived, not canonical.** See below. |

## The Rules page is derived

The public Rules page restates scoring and yardage rules in member-friendly language. It is
**derived from** [scoring-rules.md](./scoring-rules.md) and the yardage table — when a rule
changes, update the canonical home *and* the Rules page **in the same PR**, and say so in
the PR body. If the page and this directory ever disagree, this directory wins and the page
is the bug.
