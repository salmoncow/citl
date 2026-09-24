# Feature: Site Redesign ("Range Day" visual system)

**Feature ID**: 006-site-redesign
**Created**: 2026-09-24
**Status**: Draft — ready for `/implement` once the Open Questions below are resolved or their
stated defaults are accepted. **Phase 1 is partially implemented as uncommitted changes in the
working tree** (branch `claude/wonderful-babbage-qzoupz`: `tokens.css`, `base.css`, `nav.css`,
`layout.css`, `buttons.css`, new `components.css`, `index.html`, `main.ts`, `navigation.ts`,
`@fontsource/*` deps). This spec adopts that work's token *names*; task 1.0 reconciles it
against the acceptance criteria below.
**Tasks**: [tasks.md](./tasks.md)
**Design source**: approved mockups in [`mockups/`](./mockups/) (8 artboards; canvas reference
https://claude.ai/artifact/5jfDgtL7FWX3SDeA6YsVtx). All data in the mockups is sample data.

---

## Overview

citl.club is being redesigned. The new look is the "Range Day" visual system: a warm ivory
background, navy structure, clay-orange accents, condensed uppercase display type, and
tabular mono numbers. The redesign covers every public page (Home, Scorecards, Rules, About,
Downloads) and the Admin portal. It also turns the Home page from a standings table into a
season dashboard: next shoot, key stats, standings with movement, league news, the season
calendar, and award races.

This is a **presentation-layer feature**. It changes no data model, Firestore rules, indexes,
Cloud Functions, routes, scoring rules, or admin write paths. Every number on screen comes
from services and pure functions that already exist, or from new pure view-model functions
that use data the page already loads. The only exception is the award races (DD-6), which
needs the maintainer's decision (OQ-1). Delivery is split into five phases. Each phase ends
with a green `npm run typecheck && npm run lint && npm test && npm run build`.

### Source-of-truth precedence

1. **This spec** decides behavior, data sourcing, accessibility, and scope.
2. **The mockups** decide the visuals: layout, hierarchy, tokens, type, radii, and spacing.
3. Where the two conflict, the spec wins. Every conflict is listed as a deviation (DV-n) under
   DD-13 and DD-14, so none of them is a silent change.

---

## User Stories

- As a **league member**, I want the home page to show the next shoot date and where the
  season stands, so I know when to show up and how my team is doing without reading a table.
- As a **captain**, I want standings with movement, gap to the leader, and weekly rank
  points, so I can see momentum at a glance.
- As a **shooter**, I want one team's scorecard at a time with color-graded scores, so I can
  read my own line quickly, including on my phone at the range.
- As a **prospective member**, I want a clear "how to join / your first Tuesday" path, so I
  know what to bring and whom to contact.
- As **anyone reading the rules**, I want a table of contents, numbered sections, and
  worked examples, so I can find a rule quickly. On mobile I want collapsible sections.
- As the **league admin**, I want an app-style admin layout with large touch targets and a
  live calculation panel, so I can enter scores at the range on a phone and catch mistakes
  before I publish.
- As a **user who prefers dark mode**, I want every page to render correctly in dark mode,
  whether it comes from my OS preference or the theme toggle.

---

## Design Decisions

### DD-1 Tokens: keep the two-layer architecture and replace the values

- Keep the `--color-*` primitives → `--c-*` semantic layering in
  [`src/styles/tokens.css`](../../../src/styles/tokens.css) (§IV.1). Component CSS may reference
  **semantic tokens only**. Hex literals are allowed only in `tokens.css` and `print.css`.
- **Palette (light)**. The maintainer fixed these values: ground `#F3F1EC`, surface
  `#FFFFFF`, surface-alt `#F7F5F0`, line `#E2DED5`, ink `#0E1B26`, muted `#56616C`, navy
  `#0B3C5D`, deep navy `#071C2B`, deepest `#04121C`, clay `#FF8000` (**fills, and text on dark
  grounds only**), clay-text `#A84300` (orange text on light), and clay-tint `#FFF3E6`. The
  mockups add supporting navy-scale and shell values: `#0C2638`, `#12344C`, `#1C4260`,
  `#23465F`, `#9FB2C1`, `#C9D6E0`, `#D8E4EC`, `#FFB066`, and `#8A3700`.
- **Semantic groups**. These are the working-tree names and are adopted as canonical:
  grounds (`--c-bg`, `--c-card`, `--c-card-alt`, `--c-surface`, `--c-border`,
  `--c-border-strong`), text (`--c-text`, `--c-text-muted`, `--c-heading`, `--c-text-inverse`),
  brand/accent (`--c-brand`, `--c-brand-text`, `--c-brand-tint`, `--c-accent`,
  `--c-accent-text`, `--c-accent-tint`, `--c-accent-ink`, `--c-on-accent`, `--c-leader-row`),
  focus (`--c-focus`), shell (`--c-shell-*`, which stays dark in both modes), and the heat
  ramp (`--c-heat-{1..5}`, `--c-heat-{1..5}-text`, `--c-heat-empty`). The legacy aliases
  (`--c-nav-*`, `--c-table-*`, `--c-collapsible-*`) stay until the last consumer is
  restyled, then task 5.C3 removes them.
- **New non-color tokens**: a type scale (`--display-{sm,md,lg,xl}`, `--text-*`), font
  families (`--font-sans`, `--font-display`, `--font-mono`), radii (`--radius-sm` 6 through
  `--radius-2xl` 20 and `--radius-pill`), shadows (`--shadow-card`, `--shadow-dropdown`),
  `--control-height` (44px), layout (`--max-width` 1200px, `--gutter`), and
  **`--c-input-border`** (new, see DV-2).
- **Heat ramp (light)**, for a shooter's score out of 50: ≤39 `#EEF2F5` (ink text), 40–42
  `#D3E0EA` (ink), 43–45 `#A9C3D6` (ink), 46–48 `#3B6E95` (white), 49–50 `#0B3C5D` (white).
  A straight 50 also gets a 2px clay outline.
- **Dark mode**. Keep all three mechanisms: `prefers-color-scheme`, the
  `data-color-scheme` attribute, and the toggle in
  [`navigation.ts`](../../../src/modules/navigation.ts). The two dark blocks in `tokens.css`
  must stay identical, and a test enforces this (task 1.3). Dark values are derived from the
  same navy family. Grounds step up in lightness (bg < card < card-alt < surface). The heat
  ramp is **inverted in lightness** so that higher scores are brighter on a dark ground.
  The working-tree dark values are **approved as authored**. They were verified at spec time
  (ratios below, computed with the WCAG 2.x relative-luminance formula):

  | Pair (dark mode) | Ratio | Pair (dark mode) | Ratio |
  |---|---|---|---|
  | `--c-text` on `--c-bg` | 15.9 | `--c-text-muted` on `--c-surface` | 6.1 |
  | `--c-text` on `--c-card` | 14.0 | `--c-accent-text` on `--c-card` | 8.4 |
  | `--c-text-muted` on `--c-card` | 7.5 | `--c-link` on `--c-card` | 8.8 |
  | `--c-text-muted` on `--c-card-alt` | 6.9 | white on `--c-btn-primary-bg` | 7.4 |
  | heat-1…5 text on fill | 10.1 / 9.9 / 7.8 / 6.5 / 12.1 | `--c-on-accent` on clay | 6.9 |

  Light-mode pairs verified: ink on ground 15.5; muted on ground 5.6, on card 6.3, on
  card-alt 5.8, on sand 5.3; clay-text on card 6.1, on ground 5.4, on clay-tint 5.5;
  `#8A3700` on clay-tint 7.3; ink on clay fill 6.9; heat text 15.5 / 13.0 / 9.5 / 5.5 / 11.6;
  shell muted `#9FB2C1` on deep navy 7.9. **White on clay is 2.5:1 and is forbidden.** Text
  on clay fills always uses `--c-on-accent`.

### DD-2 Typography: self-hosted fonts

- Use the npm packages `@fontsource/barlow`, `@fontsource/barlow-condensed`, and
  `@fontsource/ibm-plex-mono` (pinned `^5.3.0`), imported as **per-weight latin-subset CSS**
  (`@fontsource/<family>/latin-<weight>.css`) at the top of
  [`src/main.ts`](../../../src/main.ts). Vite emits the woff2 files as hashed same-origin
  assets. That keeps the CSP `font-src 'self'` in [`firebase.json`](../../../firebase.json)
  unchanged and makes no third-party font requests (§III.2). The existing
  `**/*.@(…woff|woff2…)` cache rule applies to them.
- **Weight audit rule**: import only the weights that the final CSS actually references.
  The expected set, from the mockups:
  - Barlow 400/500/600/700
  - Barlow Condensed 700/800
  - IBM Plex Mono 500/600

  That is 8 files, about 165 kB of woff2. The working tree also imports **Barlow Condensed
  600**, and no mockup uses it. Remove it unless a component needs it (task 1.1). Plain mono
  text renders at 500 (`--font-mono` usage defaults to `font-weight: 500`) so that no 400
  file is needed.
- Roles:
  - **Display**: Barlow Condensed 700/800, uppercase, for h1/h2, KPI values, and badges.
  - **Body**: Barlow.
  - **Numbers**: IBM Plex Mono with `font-variant-numeric: tabular-nums`, for scores,
    totals, and eyebrows.
- Fallback stacks are defined in `--font-*`. `font-display: swap` comes from fontsource.
- **§IV.3 evaluation** (new runtime dependencies):
  1. They fit within the current platforms, since they are static assets on Hosting.
  2. The Google Fonts CDN alternative is rejected because it would need CSP changes and
     would repeat the ADR-008 CDN dependency.
  3. Complexity is negligible: CSS-only packages with no JS.
  4. AI migration capability is n/a (framework-agnostic).
  5. Maintenance is Dependabot bumps.

  Record this in ADR-011 (task 5.C5).

### DD-3 Layout and breakpoints

- Content max width is 1200px, centered. Side gutters are 16px at <640px and scale up to
  32px (`--gutter`). Breakpoints are **640 / 960 / 1200**, and CSS media queries use them
  mobile-first.
- **No horizontal page scroll at any width ≥ 360px.** Wide data (standings, scorecards, admin
  tables) scrolls inside a `.table-scroll` container with `overflow-x: auto`,
  `tabindex="0"`, `role="region"`, and an `aria-label`, so keyboard users can scroll it.
- Interactive controls are at least `--control-height` (44px) tall. Admin mobile steppers
  are 48px (DD-12).
- Full-bleed sections (the Home hero, the Rules hero, and dark strips) break out of
  `.main`'s max width through a route-scoped layout hook. The working tree sets
  `#main-content[data-route]` in `main.ts` `_showRoute`. That approach is approved: one line,
  presentation only.

### DD-4 In-page navigation under the hash router

[`router.ts`](../../../src/modules/router.ts) treats every `#…` as a route, so a mockup link
like `href="#standings"` or `href="#general"` would navigate to Home. **In-page targets
therefore never use fragment hrefs.** They are `<button>`s, or links with a `data-scroll-target`,
whose JS listener calls `scrollIntoView({ behavior: 'smooth' })` (or `'auto'` under
`prefers-reduced-motion`) and then moves focus to the target heading (`tabindex="-1"`). This
applies to the hero's "Week N results" CTA and the Rules TOC. The skip link in `index.html`
(`href="#main-content"`) is the one exception. It must be handled the same way: the listener
focuses `#main-content` and calls `preventDefault`.

### DD-5 Data sourcing: zero new Firestore reads

Every Home and Scorecards element derives from data the page **already** loads through the
shared `ScoreService` cache (§III.4, §VI.1). The derivation functions are pure and
unit-tested (see Architecture). Sources:

| UI element | Source (already loaded) | Derivation |
|---|---|---|
| Next-shoot card: date, "Week N of 15", progress bar | `computeSchedule(year)` + `season.weekDateOverrides` + `season.currentWeek` | `applyWeekDateOverrides` (extracted from `season-calendar.ts`, DD-8) → first non-cancelled shoot event on or after today. Progress = `currentWeek / 15` (published weeks). |
| Makeup-deadline callout | schedule only | For next shoot week N ≥ 3: "Week N−2 makeups close Fri {date of week N + 3 days}". This restates rule 4.2 (the close of the second week after a missed week) and uses the rule's own "Friday at midnight" definition. It is hidden in weeks 1–2 and when week N is the final week, because the end-of-season grace differs. |
| KPI "Season leader" + gap | `season.standings` | rank-1 team; gap = its points − rank-2 points |
| KPI "League average" + sparkline + trend | `getAllWeekResults(year)` | per week: mean of `teamResults[].targets` ÷ 5 (per-shooter, out of 50); trend = latest − week 1 |
| KPI "Straight 25s" | `weekResults[].accolades` | count of `streak === 25`; sub-line counts `streak === 50` and names the most recent one |
| KPI "Top Gun" | depends on DD-6 | complete season: `season.awards.highestAvgShooter`/`highestAvg` (0 reads); in progress: rank 1 of the Top Gun race (DD-6). **If OQ-1 rejects the race reads, drop this tile for in-progress seasons** (per the maintainer rule "drop the tile rather than add queries"). |
| Standings: position badge, gap | `season.standings`, or `computeStandingsFromWeeks(weeks, N)` for week views | badge tiers: 1st = clay fill with `--c-on-accent`, 2nd–3rd = `--c-brand` with white, others = neutral. gap = leader points − row points. |
| Standings: movement ▲/▼/— | `computeStandingsFromWeeks(weeks, N)` vs `(weeks, N−1)` | rank delta. Shows "—" in week 1 and when the team was absent the week before. Direction is carried by the glyph **and** visually hidden text ("up 2 places"). |
| Standings: rank-points-by-week bars | `weekResults[].teamResults[]` by `teamId` | one bar per published week, height ∝ rankPoints (max 30). Highlighted (clay) when the team had that week's top rank points. |
| Calendar strip (16 cells) | schedule + overrides + `currentWeek` | practice + 15 shoot weeks. States: final (≤ currentWeek), next up, upcoming, **cancelled** (override `null`), **moved** (override date, shown with a badge). A July 4 skip adds a footnote, not a cell. |
| Scorecards team summary (points, targets, rank pts, bonus, place, captain) | `getAllSeasons()` (has `standings`), `buildScorecardData(year)`, `getTeams(year)` (a cache hit, because `buildScorecardData` already fetched it) | "N weekly wins" = weeks where the team's rankPoints was that week's max. "Beat avg X of Y" = weeks with bonusPoints ≥ 5 (a rookie bonus is ≤ 2, so ≥ 5 implies the target bonus). "per night" = targets ÷ weeks shot. |
| Heat-grid cell class | shooter score | `heatBin(score): 1..5` (≤39, 40–42, 43–45, 46–48, 49–50) |

**Read de-duplication (prerequisite, task 2.1)**: `ScoreService`'s TTL cache has no in-flight
de-duplication. When several Home components request the same key at once on a cold load,
each one reads Firestore (this already happens today: `home-standings` and `season-calendar`
both call `getSeason`). Before new Home components add consumers, extract the cache helpers
from [`score-service.ts`](../../../src/services/score-service.ts) into
`src/services/ttl-cache.ts` and add in-flight promise sharing. Constraint: `score-service.ts`
is at 742 lines, against the §II.3 hard limit of 750, so this task **must reduce** its line
count.

### DD-6 Award races

- **Completed seasons** use the stored `season.awards` (0 reads). `home-standings` keeps
  rendering the selected year's awards and restyles them as award cards.
- **In-progress seasons**: a new `<award-races>` component shows the top 3 for Top Gun,
  Rookie of the Year, and Most Improved, through `SeasonAwardsService`. It renders only
  when the latest season has `currentWeek ≥ 1` and `status !== 'complete'`.
- **Engine surface**: `computeSeasonAwards` returns winners only. Add an exported
  `rankAwardCandidates(shooters, limit)` to
  [`scoring-engine.ts`](../../../src/services/scoring-engine.ts). It returns the ordered
  eligible list for each award, using the **same** eligibility (dummies excluded,
  `weeksShot ≥ 6`, `computeShooterAverage` over W1–W15, `computeMostImprovedScore`). Then
  refactor `computeSeasonAwards` to take each winner from the head of those lists. Winners
  must be byte-identical: ties are ordered by a stable sort that keeps input order, which
  matches the current `reduce` with strict `>`. The existing engine and
  `season-awards-service` tests are the parity gate. Add
  `SeasonAwardsService.previewAwardRaces(year, limit = 3)`. The `@scoring` agent reviews
  this task (OQ-2).
- **Display**: values follow the engine's definitions. Most Improved shows the engine's
  percent string, **not** the mockup's "+5.3" (DV-8). Before any shooter reaches 6 nights, a
  card shows "Eligible after 6 nights shot" and no rows.
- **Read cost (the only new reads in this feature)**: `buildScorecardData(year)` also reads
  teams and weeks for `year−1` and `year−2`. That is roughly 4 collection queries and
  about 45–50 document reads per cold session. Prior seasons are immutable and cached for
  an hour. **Mitigation**: `<award-races>` does not load until it scrolls into view (an
  `IntersectionObserver`, disconnected in `disconnectedCallback`). Its skeleton is sized to
  avoid layout shift. A visitor who has already opened Scorecards gets a full cache hit.
  **This needs maintainer approval (OQ-1).** If rejected, `<award-races>` is not built and
  the Top Gun tile is dropped for in-progress seasons.

### DD-7 Home states

The home dashboard handles four season states, which the next-shoot card and KPI tiles
derive from the schedule and the latest `Season`:

- **Pre-season** (before the practice date): the card shows the practice date as "Season
  opens". KPIs show the previous season's final values, labeled with that year.
- **In season**: as in the mockup.
- **Season complete** (`status === 'complete'`): the card shows "Season complete" and the
  champion from `season.awards.firstPlaceTeam`. The calendar strip shows all weeks final.
- **Off-season with no current-year season document**: the card shows the computed
  practice date for the current year.

No state may render `NaN`, `undefined`, or empty tiles. A tile with no value shows "—" plus
an explanatory sub-line.

### DD-8 Schedule overrides as a shared pure utility

Move `_applyOverrides` from [`season-calendar.ts`](../../../src/components/season-calendar.ts)
into [`src/utils/schedule.ts`](../../../src/utils/schedule.ts) as `applyWeekDateOverrides()`
without changing its behavior. Add `nextShootEvent(schedule, today)`. Both are unit-tested
in `schedule.test.ts`. `season-calendar.ts`, `home-hero.ts`, and the admin date card consume
them.

### DD-9 Keep components thin and under size limits

Rendering stays in components. Derivations go into pure, tested modules, following the
spec 003 layering: services may import only `@/types/*`, `scoring-engine`, and utils, and
must never import components or modules (§II.3, §II.4). These files are near or over the
§II.3 500-line target and must end **below 500**:

- `score-entry-tab.ts` (593): split out the date-override card and the calc panel.
- `home-standings.ts` (393): its view-model moves to a service.
- `admin-tables.css` (500): move the skeleton utilities out (task 1.4).

No file may cross 750. Every new component follows the
[component contract](../../../src/components/README.md), items 1–5.

### DD-10 Scorecards: tabs replace the collapsibles; print shows everything

- Season selection uses a chip row (`role="tablist"`, one chip per season from
  `getAllSeasons`) at ≥640px and a native `<select>` below 640px.
- Team selection uses tabs (ARIA APG tabs pattern: roving `tabindex`, ←/→/Home/End keys).
  Tabs are ordered by season place when standings exist, otherwise by block order. The
  default tab is 1st place.
- **All team panels are rendered.** Inactive panels get `hidden`. `print.css` forces every
  panel visible (`[hidden]` override inside `@media print`), with the heat grid printed in
  neutral grayscale (white cells, black text, and a thin border for straight 50s). This
  preserves the current "print shows every team" behavior.
- Heat grid, desktop: sticky first column. Columns are shooter · R · START (the existing
  `w0Display`) · W1–W15 · SHOT · AVG, followed by the TOTAL TARGETS / RANK POINTS / BONUS
  POINTS rows. Weeks not yet played render as dashed empty cells; did-not-shoot renders
  "–" in `--c-text-muted`. Dummy rows are visually de-emphasized. Captain (C) and rookie
  (R) badges come from `Team.captain` and `ScorecardRowShooter.rookie`. Color is never the
  only signal, because the number is always printed. Each cell carries a `title` and an
  accessible name ("Week 6: 50 of 50, straight 50").
- Below 640px the grid is replaced by **shooter cards**: a 6-column grid of cells for W1
  through the last published week, wrapping onto more rows. The team-by-week totals become
  a compact table. Both markups are rendered and CSS shows one per breakpoint, so print
  uses the table.

### DD-11 Rules: same text, new structure

- [`src/views/rules.ts`](../../../src/views/rules.ts) keeps **every rule's wording
  verbatim**, including sub-items, the makeup example paragraph, and rule 3.9. The
  condensed copy in the mockups is not used (DV-5). Only the markup around the text
  changes:
  - numbered section cards (`<section>` + `<h2>` with a number badge);
  - the makeup example restyled as the four-step strip, whose labels paraphrase the
    existing example sentence;
  - a rank-points ladder generated from `computeRankPoints` over 8 distinct targets, so it
    is not hard-coded;
  - the yardage table generated from `YARDAGE_TABLE`;
  - the trophy cards.
- **At-a-glance tiles**: six summary tiles, each tied to a rule number (5–15 shooters → 2.1;
  50 targets → About/format; 30 pts → 5.3; +5 → 5.5; 2 weeks → 4.2; 6 nights → 6.3). Tile
  copy must not state anything the rules don't say. The checklist includes a review step.
- **Collapsible sections** use `<details>`/`<summary>` inside each section card. A new
  `<rules-toc>` component handles the behavior:
  - ≥960px: all sections open, and toggling is suppressed.
  - <960px: all sections collapsed by default, except the one targeted from the TOC.
  - TOC clicks scroll per DD-4.
  - The active section is highlighted with an `IntersectionObserver`.
  - A `matchMedia` listener reacts to width changes. The listener and the observer are
    torn down in `disconnectedCallback`.
  - A "Print rules" button calls `window.print()`, and print CSS expands every section.
    This replaces the mockup's "Download PDF" (DV-6).
- The existing `id="scoring-and-yardage"` anchor id is kept on section 5.

### DD-12 Admin: app shell and live calculation

- **Shell**: [`admin-panel.ts`](../../../src/components/admin-panel.ts) replaces the
  horizontal tab strip with a sidebar: `<nav aria-label="Admin">` with **the same five
  entries in the same order and with the same `data-tab` values** (Team Management, Score
  Entry, Announcements, Season End, Users). The active entry has `aria-current="page"`.
  Tab switching, lifecycle hooks, lazy-mount semantics, and the year selector's behavior
  are unchanged. The year select moves into the top bar.
- **Auth chrome**: `#admin-user-display`, `#admin-sign-out`, `#admin-sign-in`, and
  `#admin-sign-out-unauth` stay in [`views/admin.ts`](../../../src/views/admin.ts) with the
  same IDs, because `main.ts` wires them right after the view renders, before
  `<admin-panel>` lazily mounts. They are placed **visually** in the sidebar footer by a CSS
  grid on `#admin-panel-container`, with `admin-panel { display: contents }`. Showing the
  role label ("Owner"/"Admin") is optional. It would be set through `textContent` in
  `_applyAdminViewState`.
- **Site chrome**: while the admin panel is visible, the public header and footer are
  hidden by pure CSS (`body:has(#admin-panel-container:not([hidden])) …`). The sidebar logo
  links back to `#/`. The signed-out and unauthorized states keep the public chrome (DV-7).
- **Mobile (<960px)**: the sidebar becomes a slide-in drawer opened from a 44px "Admin menu"
  button in a dark top bar. The drawer has `aria-expanded` and `aria-controls`, and Escape
  or selecting an entry closes it. Its listeners are removed in `disconnectedCallback`.
- **Score entry restyle**:
  - Team chips replace the `#ap-team` select. They are a radiogroup; the status comes from
    the entries already fetched by `_loadSavedEntries` (Entered / Pending / Editing).
  - A draft pill shows "N of M teams entered · not published".
  - Shooter rows show a GOING-IN column.
  - The Publish button moves to the top bar. Its behavior and confirmation are unchanged.
  - The date-override card keeps its lock, edit, and cancel logic verbatim; it is only
    extracted (DD-9).
  - **No change** to validation, the `saveEntry`/`publishWeek` calls, their arguments, or
    their toasts.
- **Live calculation panel** (restyle plus new read-only display): team total out of 250,
  vs going-in (delta, sum, and "+5 bonus" / "no bonus"), rookie bonus with a per-rookie
  explanation (for example "B. Tate at 35.0 · needs < 35", or "No rookie points after Week
  10"), and yardage (going-in sum → range → yards). It is computed by a new pure
  `previewTeamNight()` in `src/services/score-entry-preview.ts`. That function **only
  composes existing engine functions**: it runs the publish path's
  `computeSeasonTotals(buildSeasonData(year, teams, entries′, week))`, with this team's
  week-N entry replaced by the on-screen draft, then reads `computeGoingInAverageSum`,
  `computeTargetBonus`, and `computeRookieBonus` for the team, and `lookupYardage()` (new,
  DD-12a). Inputs are `ctx.getTeamsData()` plus the entries for weeks ≤ N, which
  `_loadSavedEntries` already fetches, so there are 0 extra reads. Updates are debounced
  about 150ms on input. The panel is labeled "Preview — publish computes the official
  result".
- **DD-12a `lookupYardage(sum)`**: [`CLAUDE.md`](../../../CLAUDE.md) documents it, but it does
  not exist yet. Add it to [`src/utils/yardage.ts`](../../../src/utils/yardage.ts) as a
  direct reading of rule 5.7 and `YARDAGE_TABLE`. The sum is rounded to 2 decimals, which
  closes the .49/.50 gaps. Values below 0 are invalid, and values above 250 clamp to the
  last row. It is unit-tested at every boundary.
- **Mobile score entry**: shooter cards with two bunker **steppers** (−/+ buttons, 48px). The
  steppers write to the same `.ap-score-input` number inputs, clamped to 0–25, so the save
  path does not change. A sticky dark footer holds TOTAL / VS AVG / BONUS and the save
  button.
- **Other admin tabs** (Team Management, Announcements, Season End, Users) get the shared
  admin styles (cards, tables, forms, buttons, dialogs) and no structural change.

### DD-13 Accessibility deviations from the mockups

| ID | Mockup | Spec | Why |
|---|---|---|---|
| DV-1 | (no focus style shown); working tree uses a clay 3px outline | Light mode: `--c-focus` = navy `#0B3C5D` (11.6:1). Shell, dark mode, and dark strips: clay (6.5:1 on dark card). Always `:focus-visible`, 3px outline, 2px offset. | Clay on ivory/white is 2.2–2.5:1, which fails WCAG 1.4.11's 3:1 minimum |
| DV-2 | Input/select borders `#D5D0C5` | New `--c-input-border` ≥ 3:1 against every ground it sits on (e.g. `#7A848D`: 3.8 on white, 3.4 on ivory, 3.2 on sand). Decorative card borders keep `--c-border`. | `#D5D0C5` on white is 1.5:1, below the 3:1 needed to identify a control (1.4.11) |
| DV-3 | Neutral grey `#9AA3AB` for "—" movement, DNS dash, future week headers | `--c-text-muted` | `#9AA3AB` is 2.4–2.6:1, below AA text contrast |
| DV-4 | `href="#section"` anchors | JS scroll (DD-4) | The hash router would navigate away |

The straight-50 clay outline (2.5:1 against white) is **supplementary**. The printed value
"50" and the cell's accessible name already carry the information, so 1.4.11 does not apply.

### DD-14 Mockup elements excluded or deferred

The following are **excluded** because they have no backing behavior or data. Adding them
would change behavior or the data model.

- Admin: "Autosaved", "+ Add shooter", "+ Add dummy", "Mark as makeup round", and
  "Preview standings".
- Announcement category tags ("Results", "Deadline"): there is no data field.
- The "All announcements" link: there is no route (§ out of scope). Home instead shows the
  3 most recent announcements, which are already fetched in full.
- The Standings "Season / This week" segmented control: it duplicates the existing Week
  select, which already has a "Season" option.
- The Rules "Download PDF" button: no PDF exists, so "Print rules" replaces it.

**Optional stretch items**, not required for acceptance. Each needs its own task and must
also meet every global acceptance criterion.

- S-1: Home results **ticker**.
- S-2: Admin **"Week N rank preview"** (`computeRankPoints` over the draft pass, 0 reads).
- S-3: Admin **"Needs attention"** panel.
- S-4: Admin "Save & next team".
- S-5: Rules **search** (client-side text filter over the static rules).
- S-6: Scorecards **"Team targets by week" chart and highlights** (derivable from
  `buildScorecardData`).
- S-7: Scorecards summary **"Yardage"** metric.
- S-8: Home **venue card** (static; the map embed stays on About only).

---

## Acceptance Criteria

### Global (checked at the end of every phase for the pages touched so far)

- [ ] **AC-G1 Visual parity**: at 1440px and at 390px, each redesigned page matches its
      mockup artboard (Main/HomeMobile, Scorecards/ScorecardsMobile, Rules/RulesMobile,
      Admin/AdminMobile) in section order, grid structure, token colors, type family and
      weight, font size (±2px), radii, and spacing rhythm, apart from the deviations DV-1
      to DV-8 and the DD-14 exclusions. Evidence: side-by-side screenshots in the PR.
- [ ] **AC-G2 No overflow**: at 360, 390, 640, 960, 1200, and 1440 wide, on every route,
      `document.documentElement.scrollWidth <= document.documentElement.clientWidth`. Wide
      tables scroll only inside `.table-scroll` regions, which are keyboard-focusable.
- [ ] **AC-G3 Contrast**: all text meets WCAG AA (4.5:1, or 3:1 for large text), and UI
      component boundaries and focus indicators meet 3:1, in both color schemes. A
      Lighthouse/axe accessibility run on each route in light and dark mode reports **0
      color-contrast violations**. No white text on a clay fill.
- [ ] **AC-G4 Keyboard and focus**: every interactive element is reachable in DOM order and
      shows a `:focus-visible` indicator (DV-1). There are no keyboard traps. Tabs and chip
      groups follow the ARIA APG keyboard pattern. The burger menu, dropdown, and admin
      drawer expose `aria-expanded` and close on Escape. The skip link works (DD-4).
- [ ] **AC-G5 Dark mode parity**: every route renders correctly under OS dark mode, under the
      explicit `data-color-scheme="dark"`, and under the explicit light setting while the
      OS is dark. The toggle icon and label update. Component CSS contains no hex literals
      (`grep -nE '#[0-9a-fA-F]{3,8}\b' src/styles/*.css` finds matches only in `tokens.css`
      and `print.css`).
- [ ] **AC-G6 Budgets**: JS stays under 250 kB gzipped (§III.4). CSS stays within the
      [build-system](../../technical/build-system.md) budget (<20 kB gzipped), or task 5.C4
      amends that budget with measured numbers. Fonts: only latin woff2 files for the
      audited weights are requested, ≤ 180 kB in total. The network panel shows **no
      requests to fonts.googleapis.com or fonts.gstatic.com**.
- [ ] **AC-G7 File size**: no file under `src/` exceeds 750 lines. Every file this feature
      creates or substantially rewrites is under 500 (§II.3), including `score-entry-tab.ts`
      after the split.
- [ ] **AC-G8 Forbidden patterns**: `scripts/check-constitution.sh` reports 0 `forbid` and no
      new `warn` findings on changed files. The ruleset in
      [`scripts/forbidden-patterns.json`](../../../scripts/forbidden-patterns.json) is canon
      (§IV.2).
- [ ] **AC-G9 Output safety**: every Firestore- or user-sourced string (team, captain, and
      shooter names, announcement titles, banner text, email) reaches the DOM through
      `textContent` or `escapeHtml()`. Announcement bodies go only through `renderMarkdown`
      (DOMPurify) (§III.2, component contract item 2).
- [ ] **AC-G10 Skeletons**: every async component (existing and new) renders `.skeleton*`
      placeholders shaped like the new layout before its first `await`, then data, then a
      distinct error state (§III.3). The shimmer works in both color schemes.
- [ ] **AC-G11 No data or security changes**: `git diff main --stat` shows no changes to
      `firestore.rules`, `firestore.indexes.json`, `functions/`, `src/repositories/`, or
      `src/types/` (types may only gain optional, display-only fields, and ideally none).
      The admin write calls and their arguments are identical. Firestore reads per cold
      Home visit do not exceed the pre-feature count, except for the DD-6 award-race reads
      if OQ-1 approves them.
- [ ] **AC-G12 CSP intact**: the `firebase.json` headers are unchanged.
      `node scripts/check-csp-hash.js` passes, because the inline theme script in
      `index.html` is byte-identical.
- [ ] **AC-G13 Motion**: under `prefers-reduced-motion: reduce`, the shimmer animation,
      smooth scrolling, and transitions are disabled.
- [ ] **AC-G14 Gate**: `npm run typecheck && npm run lint && npm test && npm run build` is
      green, and `npm run test:rules` still passes (unchanged).

### Phase 1 — Foundation

- [ ] **AC-1.1** Tokens match DD-1. The two dark blocks are identical, and a unit test
      asserts this. `--c-input-border` and a light-mode navy `--c-focus` exist (DV-1, DV-2).
- [ ] **AC-1.2** Fonts are imported per DD-2, and the weight set matches the audit.
      Headlines render in Barlow Condensed, body in Barlow, and numbers in Plex Mono with
      tabular numerals.
- [ ] **AC-1.3** Shell: the dark navy header has the target-mark logo, wordmark,
      sub-wordmark (hidden below 960px), primary nav (Home, Scorecards, Rules, About,
      Downloads, and the Resources dropdown), the theme toggle, and the "Join the league"
      CTA (links to `#/about`, or see OQ-3). The active link uses `aria-current="page"` as
      well as `.is-active`. Below 960px there is a burger with `aria-expanded`, and the menu
      closes on route change and on Escape. The dark footer has the blurb, League and
      Resources columns, and the Admin link. The admin link keeps the
      `.footer__admin-link` class, and `updateAuthState` still hides it for role `user`.
- [ ] **AC-1.4** Base typography, buttons (primary navy, accent clay with ink text,
      secondary, ghost-on-dark, danger), and form controls (44px, DV-2 borders, custom
      select arrow per scheme) are restyled. Toasts and `site-banner` use the new tokens,
      and the banner stays sticky under the new header height.
- [ ] **AC-1.5** The skeleton utilities move to their own stylesheet, imported early and
      unchanged in API (`.skeleton`, `--sm/md/lg/xl`, `-group`, `-row`). All existing
      skeletons still render.
- [ ] **AC-1.6** Pages not yet restyled (Scorecards, Rules, About, Downloads, Admin) remain
      legible and usable on the new tokens, through the legacy aliases, with no broken
      layout at 360px.

### Phase 2 — Home

- [ ] **AC-2.1** In-flight de-duplication: concurrent identical `ScoreService` reads share
      one repository call (unit test). `score-service.ts` ends up smaller than 742 lines.
      Existing score-service tests pass unchanged.
- [ ] **AC-2.2** The hero and next-shoot card render every DD-7 state correctly. Unit tests
      in `schedule.test.ts` cover `applyWeekDateOverrides` (moved without behavior change)
      and `nextShootEvent`, including the July 4 skip, a cancelled week, a moved week, and
      the practice-day and post-season edges. The makeup callout follows DD-5.
- [ ] **AC-2.3** KPI tiles follow DD-5. Each derivation is unit-tested with fixture week
      docs, including an empty season. The sparkline SVG has `role="img"` and an
      `aria-label` that summarizes the series.
- [ ] **AC-2.4** Standings: position badges, movement (glyph plus hidden text), gap, and
      per-week bars (each with a text label). The leader row uses `--c-leader-row`. The
      existing Season and Week selects keep their behavior, including the historical-week
      view through `computeStandingsFromWeeks` (spec 005 DD-5). The accolades list and
      season awards are restyled. The table is a `.table-scroll` region at 640–960px; below
      640px it uses the compact column set (POS, TEAM + movement + targets, FORM, GAP, PTS)
      from HomeMobile. The view-model is unit-tested, and `home-standings.ts` stays under
      500 lines.
- [ ] **AC-2.5** Announcements: the three most recent posts render as cards with a month/day
      block, an escaped title, and the markdown body. When there are none, the section is
      omitted, as today.
- [ ] **AC-2.6** The calendar strip has 16 cells with every DD-5 state. It is a 16-column
      grid at ≥960px and a horizontally scrollable strip at <960px, and the scrolling stays
      inside its container.
- [ ] **AC-2.7** Award races follow DD-6, or are dropped if OQ-1 rejects them. Winners
      match `computeSeasonAwards` for every fixture (parity test). The component does not
      load until it is in view.
- [ ] **AC-2.8** The "Your first Tuesday" card is static markup. Its copy is consistent with
      About and Rules 2.2 (no new rules). The CTA follows OQ-3.

### Phase 3 — Scorecards

- [ ] **AC-3.1** Season chips (≥640px) and a select (<640px) drive the same load with the
      re-entrancy guard (component contract item 5). Team tabs follow DD-10 and meet the
      ARIA APG tab keyboard behavior.
- [ ] **AC-3.2** The dark team summary strip shows place, name, captain, shooter and rookie
      counts, points, targets, rank pts, and bonus, each with a sub-line per DD-5.
      Derivations live in the pure `scorecard-summary.ts` and are unit-tested.
- [ ] **AC-3.3** The heat grid follows DD-10: `heatBin` is unit-tested at each boundary
      (39/40, 42/43, 45/46, 48/49, 50). The legend matches the ramp. Straight 50s get the
      outline plus an accessible name. DNS and future cells are distinct from each other.
- [ ] **AC-3.4** Mobile (<640px) shows shooter cards and the team-by-week totals table, with
      no horizontal page scroll.
- [ ] **AC-3.5** Printing: every team is printed, readable in black and white, with no
      navigation or controls. `print.css` selectors are updated for the new markup.

### Phase 4 — Rules, About, Downloads

- [ ] **AC-4.1** Rule text parity: a unit test extracts the text content of every `<li>` and
      `<p>` from `rulesView()` and compares it with a checked-in snapshot taken **before**
      the restructure (task 4.1). Only whitespace normalization is allowed.
- [ ] **AC-4.2** At-a-glance tiles, numbered section cards, the makeup example, the rank-points
      ladder (from `computeRankPoints`), the yardage table (from `YARDAGE_TABLE`), and the
      trophy cards render per DD-11.
- [ ] **AC-4.3** `<rules-toc>`: sticky TOC at ≥960px with active-section highlighting;
      accordion below 960px; TOC activation scrolls and moves focus without changing
      `location.hash` (DD-4). The observer and listeners are torn down on disconnect.
      "Print rules" prints every section expanded.
- [ ] **AC-4.4** About and Downloads get a page header (eyebrow plus display h1), prose cards,
      the map in a rounded card (the iframe is unchanged, so the CSP is unchanged), and
      the scoresheet generator and yardage table restyled as cards. Their print isolation
      (`print-scoresheets` / `print-yardage`) works as before.

### Phase 5 — Admin

- [ ] **AC-5.1** The sidebar shell has the same five entries, order, and `data-tab` values.
      Switching, lifecycle hooks, the year selector, and lazy mount/unmount are unchanged.
      The auth element IDs are unchanged. Public chrome is hidden only while the panel is
      visible (DD-12).
- [ ] **AC-5.2** Mobile admin: the drawer navigation works by touch and keyboard. Every
      control is at least 44px, and the steppers are 48px.
- [ ] **AC-5.3** Score entry: team chips with derived status, the draft pill, and the GOING-IN
      column. `saveEntry` and `publishWeek` receive the same arguments as before for the same
      user input. Verify with a unit or DOM test of the entry-building code path, or a
      scripted emulator run. The date-override card behaves identically: lock, edit,
      cancel, past-date, and scores-present cases.
- [ ] **AC-5.4** The live calculation panel follows DD-12. `previewTeamNight` is unit-tested
      against fixtures whose published results are known. The preview's targets, target
      bonus, and rookie bonus equal what `computeSeasonTotals` produces for the same
      entries. `lookupYardage` is unit-tested at every table boundary.
- [ ] **AC-5.5** `score-entry-tab.ts`, the extracted date card, and the calc panel are each
      under 500 lines. The other admin tabs are restyled and behave the same.
- [ ] **AC-5.6** The documentation and constitution close-out tasks (5.C1–5.C7) are merged.

---

## Constitutional Constraints

- **§I.1 Progressive complexity**: no framework, no CSS preprocessor, no component library.
  The design uses plain CSS custom properties and Web Components.
- **§I.2 / §IV.3 Platforms and dependencies**: the platforms are unchanged (Firebase + GitHub).
  The three `@fontsource` packages are evaluated in DD-2 and recorded in ADR-011.
- **§II.3 Modularity**: dependency direction is components → modules → services →
  repositories. The 500-line target and 750-line hard limit apply (DD-9). No component calls
  Firestore.
- **§II.4 Layer responsibilities and the component contract**: components render. The
  derivations go into pure services and utils. Shared services come through
  `getServices()`. Teardown happens in `disconnectedCallback` (observers, `matchMedia`, and
  drawer listeners). The re-entrancy guard is used.
- **§III.2 Security**: `escapeHtml`/`textContent` for all dynamic strings, and the CSP is
  unchanged (fonts are self-hosted). Admin authority stays in the Firestore rules. This
  feature does not alter any client-side role check.
- **§III.3 Loading states**: `.skeleton` classes for every async component. The utilities'
  file location changes, and §III.3 is updated to match (task 5.C1).
- **§III.4 Performance**: the JS budget is 250 kB gzipped. Firestore queries are unchanged,
  and caching is reused and improved (in-flight de-duplication).
- **§III.5 Code quality**: `@/` imports, strict TypeScript, explicit return types,
  `noUncheckedIndexedAccess` guards, and no inline handlers.
- **§IV.1 Styling**: two-layer tokens and system-aware dark mode. The line must be amended to
  mention the self-hosted fonts and the design language (task 5.C1).
- **§IV.2 Forbidden patterns**: canon is `scripts/forbidden-patterns.json` (AC-G8).
- **§VI.1 Cost**: zero new reads except DD-6 (OQ-1). The font payload affects Hosting
  transfer; it is cached with `immutable` headers (OQ-7).
- **§V.2 Guidance gap**: the constitution has **no accessibility standard**. This spec
  proceeds with the documented assumptions in DD-13 and AC-G3/G4 (option c), and proposes
  §III.6 (OQ-6).

---

## Architecture Approach

### Layer assignments

| Layer | New | Modified |
|---|---|---|
| **Components** (`src/components/`) | `home-hero.ts`, `season-kpis.ts`, `award-races.ts` (conditional on OQ-1), `rules-toc.ts`, `admin-tabs/score-entry-date-card.ts`, `admin-tabs/score-entry-calc.ts` | `home-standings.ts`, `home-announcements.ts`, `season-calendar.ts`, `site-banner.ts`, `season-scorecards.ts`, `yardage-table.ts`, `scoresheet-generator.ts` (classes only), `admin-panel.ts`, `admin-tabs/score-entry-tab.ts`, the other `admin-tabs/*` (classes only) |
| **Views** (`src/views/`) | — | `home.ts` (composition plus the static first-Tuesday card), `rules.ts` (structure only), `about.ts`, `downloads.ts`, `admin.ts` (layout wrapper, same IDs) |
| **Modules** (`src/modules/`) | — | `navigation.ts` (aria-expanded, aria-current, skip link, footer year) |
| **Services** (`src/services/`) | `ttl-cache.ts`, `home-stats.ts` (KPI, standings view-model: movement, gap, form bars), `scorecard-summary.ts` (heatBin, team summary), `score-entry-preview.ts` (`previewTeamNight`) | `score-service.ts` (uses `ttl-cache`, net line reduction), `scoring-engine.ts` (`rankAwardCandidates` + refactored `computeSeasonAwards`, DD-6), `season-awards-service.ts` (`previewAwardRaces`) |
| **Utils** (`src/utils/`) | — | `schedule.ts` (`applyWeekDateOverrides`, `nextShootEvent`), `yardage.ts` (`lookupYardage`) |
| **Styles** (`src/styles/`) | `components.css` (already in the working tree), `skeleton.css`, `home.css`, `scorecards.css`, `rules.css`, `admin-shell.css` (split further if any file nears 500 lines) | `tokens.css`, `base.css`, `nav.css`, `layout.css`, `buttons.css`, `forms.css`, `tables.css`, `banner.css`, `toast.css`, `about.css`, `scoresheet.css`, `admin.css`, `admin-tables.css`, `print.css` |
| **Shell** | — | `src/index.html` (header/footer markup; **inline theme script untouched**), `src/main.ts` (font and CSS imports, `data-route`, component registrations) |
| **Repositories / types / rules / functions** | — | **none** (AC-G11) |

New pure modules follow the `standings.ts` import rule: `@/types/*`, `scoring-engine`,
`scorecard-builder`, and `@/utils/*` only. Each gets a colocated `*.test.ts`.

### Guidance references

- [Component contract](../../../src/components/README.md). Spec 003's composition-root pattern.
- [Scoring rules](../../domain/scoring-rules.md) govern every number the live panel and the
  award races display. `@scoring` reviews DD-6 and DD-12.
- [Spec 005](../archive/005-standings-unification/spec.md) DD-5: standings have exactly one
  derivation (`computeStandingsFromWeeks`). Movement and form reuse it; they do not
  re-derive it.
- [Build system](../../technical/build-system.md) (bundle and CSS budgets) and
  [firebase-deployment](../../technical/firebase-deployment.md) (CSP and cache headers).
- The global skills `software-architecture`, `security-principles`, `testing-principles`, and
  `firebase-cost-resilience` activate automatically. This feature adds **no Cloud
  Function**, so no deploy-runbook steps apply.

---

## Implementation Plan

Five phases, one PR each, merged in order. Each phase ends with the AC-G14 gate plus
screenshots for AC-G1/G2/G5. The ordered tasks, with file assignments, are in
[tasks.md](./tasks.md).

1. **Foundation**: reconcile the working-tree work; tokens, with the DV-1/DV-2 fixes and a
   dark-parity test; font audit; skeleton stylesheet; base, buttons, forms, toasts, banner;
   shell header and footer; interim legibility of pages not yet restyled.
2. **Home**: in-flight cache de-duplication, then the schedule utils, the `home-stats`
   service, `home-hero`, `season-kpis`, the standings restyle, announcements, the calendar
   strip, award races (after the OQ-1/OQ-2 resolution), and the first-Tuesday card.
3. **Scorecards**: the `scorecard-summary` service, chips and tabs, the summary strip, the
   heat grid, mobile cards, and print.
4. **Rules, About, Downloads**: the rule-text snapshot test *first*, then the restructure,
   `rules-toc`, the ladder and yardage from the canonical sources, and the About/Downloads
   restyle.
5. **Admin, then close-out**: the admin shell, the date-card extraction, `lookupYardage`,
   `previewTeamNight`, the calc panel, score-entry restyle, mobile steppers, other-tab
   restyle; then the constitution, ADR, technical-spec, domain-doc, and CLAUDE.md updates.

---

## Testing Checklist

- [ ] Unit: `ttl-cache` (TTL expiry, in-flight sharing, failures not cached).
- [ ] Unit: `applyWeekDateOverrides` (parity with the old private method), `nextShootEvent`
      (pre-season, in-season, cancelled, moved, July 4, post-season).
- [ ] Unit: `home-stats` (leader and gap, league average ÷5, sparkline series, straight
      counts, movement including absent teams and week 1, form bars and weekly winners
      including split-tie rank points).
- [ ] Unit: `rankAwardCandidates` and the parity of `computeSeasonAwards` winners across all
      existing fixtures and new tie fixtures; `previewAwardRaces` with stub repositories.
- [ ] Unit: `scorecard-summary` (`heatBin` boundaries, weekly wins, beat-average count, per-night
      average, place lookup).
- [ ] Unit: rule-text snapshot parity (AC-4.1); the ladder equals `computeRankPoints` output.
- [ ] Unit: `lookupYardage` at every boundary (175.49/175.50 … 215.49/215.50, 0, 250, >250).
- [ ] Unit: `previewTeamNight` equals `computeSeasonTotals` for the same entries (targets,
      target bonus, rookie bonus), including dummies, a rookie at exactly 35.0, week 11+,
      and fewer than 5 shooters.
- [ ] Unit: the tokens dark-block parity test.
- [ ] Manual, at 1440 / 960 / 640 / 390 / 360, in light and dark: every route (AC-G1, G2,
      G5).
- [ ] Manual: a keyboard-only pass on every route (AC-G4), and a screen-reader spot check of
      the standings, heat grid, tabs, and admin drawer.
- [ ] Manual: Lighthouse accessibility and performance on Home, Scorecards, Rules, and Admin
      in both schemes. Record the scores in the PR (AC-G3, G6).
- [ ] Manual: print preview of Scorecards, Rules, the Downloads scoresheets, and the yardage
      table (AC-3.5, AC-4.3, AC-4.4).
- [ ] Manual (emulator, `npm run dev:seeded`): an admin saves an entry and publishes a week.
      Firestore documents are identical to a pre-feature run with the same inputs (AC-5.3).
- [ ] Manual: count Firestore reads for a cold Home load in the emulator UI, before and after
      (AC-G11).
- [ ] `scripts/check-constitution.sh` on all changed files; `node scripts/check-csp-hash.js`.

---

## Open Questions / Constitutional Amendments

Each item has a **default**. `/implement` proceeds on the default unless the maintainer
overrides it. Items marked **gate** block only their own tasks.

- **OQ-1 (gate for tasks 2.8–2.9): Award-race reads.** DD-6 is the only source of new
  Firestore reads: about 45–50 document reads per cold session for prior-season data,
  loaded lazily and cached for an hour. *Default*: approve with lazy loading. *If rejected*:
  skip `<award-races>` for in-progress seasons (completed seasons still show stored awards)
  and drop the Top Gun tile while a season is in progress.
- **OQ-2 (gate for task 2.8): Engine refactor for ranked candidates.** Top-3 rows need
  `rankAwardCandidates` extracted from `computeSeasonAwards`. This is a behavior-preserving
  refactor with a parity gate, reviewed by `@scoring`. *Alternative*: leader-only cards with
  no engine change. *Default*: refactor.
- **OQ-3: "Join the league" / "Contact the coordinator" target.** The codebase has no
  coordinator email. *Default*: link to `#/about` (the Enrollment & Fees section). If the
  maintainer supplies an address, use a `mailto:` link, stored once as a constant.
- **OQ-4: Accessibility deviations DV-1 to DV-3** change mockup colors: the focus ring,
  input borders, and neutral grey. *Default*: adopt them, because AA is a stated requirement.
- **OQ-5: Hiding the admin chrome with CSS `:has()`** (DV-7). *Default*: adopt. Browsers
  without `:has` fall back to showing the public header, which is harmless.
- **OQ-6 (constitutional gap, §V.2): no accessibility standard exists.** Proposal: add a
  **§III.6 Accessibility & Responsive Standards** section covering WCAG 2.x AA contrast for
  text and UI components, visible `:focus-visible`, keyboard operability, 44px targets,
  `prefers-reduced-motion`, and no horizontal page scroll at ≥360px. This spec proceeds on
  these assumptions (option c). Task 5.C2 adds the section. It is a minor-version bump
  (1.6.0 → 1.7.0) with an ADR entry.
- **OQ-7: Font payload and Hosting transfer (§VI.1).** About 165 kB on a first visit, cached
  immutably. At CITL's traffic this is well under the 252 MB/day alert level. *Default*:
  accept. *If tighter*: drop Barlow 500 (nav links use 600) and Plex 600, which brings it to
  about 125 kB.
- **OQ-8: ScoreService in-flight de-duplication (task 2.1)** touches business-critical
  caching in a file at 742 of its 750-line limit. *Default*: do it, as an extraction that
  shrinks the file. It is required for AC-G11 once more Home components read the same keys.
- **Constitution drift found while authoring** (fix in the close-out tasks):
  - §III.3 points to `src/styles/main.css` for the skeleton utilities, but they live in
    `admin-tables.css` (and will move to `skeleton.css`).
  - §III.4 says the JS bundle is "~167 kB gzipped" while
    [build-system.md](../../technical/build-system.md) says ~34 kB. Re-measure and
    reconcile both.
  - `CLAUDE.md` documents a `lookupYardage()` that does not exist until task 5.3.
  - §II.1 inventory counts: 10 components plus 6 admin-tabs today; there will be more after
    this feature.
- **Required amendments** (tasks 5.C1–5.C7):
  - §IV.1 Styling: self-hosted `@fontsource` fonts under `font-src 'self'`, the "Range Day"
    tokens, and the heat ramp.
  - §III.3: the new skeleton file path.
  - §III.4: font and CSS budgets.
  - §II.1: counts.
  - The new §III.6 (OQ-6).
  - The version history (1.7.0).
  - ADR-011 in the decision log: "Range Day" redesign and self-hosted fonts. It supersedes
    the ADR-008 brand-strip/nav specifics and keeps ADR-008's no-CDN principle.
  - `build-system.md` budgets.
  - A yardage section in `.specs/domain/scoring-rules.md` referencing `YARDAGE_TABLE` and
    `lookupYardage`.
  - `CLAUDE.md` key-files rows.

---

## Out of Scope

- Changes to the data model, Firestore schema, security rules, indexes, Cloud Functions, or
  repositories.
- New routes or pages, including an "all announcements" page.
- Scoring-rule changes. The live panel and award races display existing rules only.
- New admin capabilities: autosave, add shooter/dummy, makeup flag, and anything else in the
  DD-14 exclusions.
- Stretch items S-1 to S-8, unless they are separately tasked.
