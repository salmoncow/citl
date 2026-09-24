# Tasks: 006-site-redesign

**Spec**: [spec.md](./spec.md)
**Status**: Not started. Phase 1 is partially present as uncommitted working-tree changes;
see task 1.0.
**Delivery**: one PR per phase, merged in order. Branch naming is `feat/redesign-p<N>-<slug>`.
Commits follow the conventional format, e.g. `feat(ui): …`, `refactor(services): …`, and
`docs(constitution): …`.

Task sizing: S ≈ ≤30 min, M ≈ ≤2 h, L ≈ ≤half day. "AC" references point to spec.md.

**Phase gate** (run this at the end of **every** phase; the phase is not done until it is
green):

```bash
npm run typecheck && npm run lint && npm test && npm run build
node scripts/check-csp-hash.js
```

At each gate, also check the pages touched so far:

- Screenshots at 1440 and 390 in light and dark, attached to the PR (AC-G1, G5).
- The overflow check (AC-G2) at 360, 390, 640, 960, 1200, and 1440. Run this in DevTools:
  `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
- A Lighthouse accessibility run with 0 contrast violations (AC-G3).
- A keyboard pass (AC-G4).
- `scripts/check-constitution.sh` clean (AC-G8).

---

## Phase 0: Preflight

- [ ] **0.1 (S)** Record the maintainer's resolution, or acceptance of the default, for
      OQ-1 to OQ-8 in spec.md as a dated "Resolved" block above the Open Questions.
      Only tasks 2.8 and 2.9 are hard-gated on OQ-1/OQ-2. Everything else proceeds on the
      defaults.
- [ ] **0.2 (S)** Take the baseline measurements and record them in the Phase 1 PR:
  - Firestore reads for a cold Home load (emulator UI, `npm run dev:seeded`).
  - `dist/` JS and CSS gzipped sizes.
  - Line counts for `score-service.ts`, `score-entry-tab.ts`, `home-standings.ts`, and
    `admin-tables.css`.
- [ ] **0.3 (S)** Snapshot the current rule text (needed by 4.1). Add
      `src/views/rules.test.ts`. It renders `rulesView()` into jsdom, extracts the
      normalized `textContent` of every `li` and `p` in document order, and compares it with
      an inline snapshot committed **now**, before any rules markup changes.
      *Check*: the test passes on the unmodified `rules.ts`.

---

## Phase 1: Foundation (tokens, fonts, base, controls, shell)

**PR**: `feat(ui): Range Day design foundation — tokens, self-hosted fonts, site shell`
**ACs**: AC-1.1 to AC-1.6, plus the global ACs for the shell.

- [ ] **1.0 (M) Reconcile the in-progress work.** Review the uncommitted changes to
      `package.json`/`package-lock.json`, `src/index.html`, `src/main.ts`,
      `src/modules/navigation.ts`, `src/styles/{tokens,base,nav,layout,buttons}.css`, and the
      new `src/styles/components.css` against DD-1, DD-2, and DD-3. Keep what conforms and
      list what the tasks below change.
      *Check*: `git diff -- src/index.html` shows the `<head>` inline theme script
      byte-identical (AC-G12).
- [ ] **1.1 (S) Font audit.**
  - Files: `src/main.ts`.
  - Keep the per-weight `@fontsource/*/latin-<w>.css` imports that final CSS references:
    Barlow 400/500/600/700, Barlow Condensed 700/800, and Plex Mono 500/600.
  - Remove Barlow Condensed 600 unless a selector uses it.
  - Set `--font-mono` consumers to 500 as the default weight.
  - *Check*: after build, `dist/assets/` contains only latin woff2 and woff files for those
    weights, and the woff2 total is ≤ 180 kB (AC-G6). The network panel shows no Google
    Fonts hosts.
- [ ] **1.2 (M) Tokens.**
  - File: `src/styles/tokens.css`.
  - Apply DV-1: `--c-focus` is navy `#0B3C5D` in light mode and clay in dark mode. Add a
    `--c-focus-on-shell` token (clay) for the dark shell and strips.
  - Apply DV-2: add `--c-input-border` (light ≥3:1 on card, ground, and sand, e.g. `#7A848D`; dark ≥3:1
    on the dark card and bg, e.g. `#5E7A90`: 3.6 and 4.1).
  - Apply DV-3: remove any `#9AA3AB`-style neutral token in favor of `--c-text-muted`.
  - Keep the legacy aliases.
  - *Check*: the AC-1.1 contrast pairs hold. Re-run the DD-1 pair table with the new tokens
    and paste the ratios into the PR.
- [ ] **1.3 (S) Dark-parity test.** Add `src/styles/tokens.test.ts` (Vitest, `fs` read). It
      parses the `@media (prefers-color-scheme: dark) :root:not(...)` block and the
      `:root[data-color-scheme="dark"]` block and asserts that their declaration sets are
      identical.
      *Check*: the test fails if either block is edited alone.
- [ ] **1.4 (S) Skeleton stylesheet.**
  - Move `@keyframes skeleton-shimmer` and `.skeleton*` from `src/styles/admin-tables.css`
    into a new `src/styles/skeleton.css`, imported right after `base.css` in `src/main.ts`.
  - Add a `prefers-reduced-motion` rule that disables the animation.
  - *Check*: the class API is unchanged; the Home, Scorecards, and Admin skeletons still
    render in both schemes (AC-1.5, AC-G13); `admin-tables.css` is now under 500 lines.
- [ ] **1.5 (M) Base, typography, and layout.**
  - Files: `src/styles/base.css`, `src/styles/layout.css`.
  - Body is Barlow on `--c-bg`. h1/h2 use the display font, uppercase, on the
    `--display-*` scale. Add utility classes for the eyebrow (mono, `--tracking-eyebrow`)
    and for numbers (`.num`, mono plus tabular-nums).
  - Add `:focus-visible` per DV-1 and a reduced-motion override for `scroll-behavior` and
    transitions.
  - Layout: `.main` width, the `--gutter` gutters, the `#main-content[data-route="/"]`
    full-bleed hook, `.table-scroll`, and `.page-header`.
  - *Check*: AC-G2 at 360 on every route; AC-G13.
- [ ] **1.6 (M) Controls.**
  - Files: `src/styles/buttons.css`, `src/styles/forms.css`, `src/styles/toast.css`,
    `src/styles/banner.css`.
  - Buttons: `.btn-primary` (navy), `.btn-accent` (clay fill, `--c-on-accent` text),
    `.btn-secondary`, `.btn-ghost-dark`, and `.btn-danger`. All are ≥44px, with no white
    text on clay.
  - Form controls: 44px inputs and selects with `--c-input-border`, and a per-scheme select
    arrow.
  - Toasts and `site-banner` use the new tokens. The banner's sticky `top` follows the
    new header height (76px desktop, 64px mobile, through `--nav-height`).
  - *Check*: AC-1.4, AC-G3.
- [ ] **1.7 (M) Shell header and footer.**
  - Files: `src/index.html` (markup only; the inline script is untouched), `src/styles/nav.css`,
    `src/modules/navigation.ts`.
  - Header: target-mark SVG (`aria-hidden`), wordmark, sub-wordmark hidden below 960px,
    primary `<nav aria-label="Primary">`, the Resources dropdown (existing behavior), the
    theme toggle, and the "Join the league" `.btn-accent` link (OQ-3 target).
  - `setActiveLink` also sets and removes `aria-current="page"`.
  - Burger: `aria-expanded`/`aria-controls`. It closes on route change and on Escape.
  - The skip link is handled per DD-4.
  - Footer: three columns (blurb, League, Resources + Admin) collapsing to one column. Keep
    the `.footer__admin-link` class so `updateAuthState` still works.
  - *Check*: AC-1.3, AC-G4; `node scripts/check-csp-hash.js` passes.
- [ ] **1.8 (S) Interim legibility.** Make the minimal edits to `tables.css`, `admin.css`,
      `admin-tables.css`, `about.css`, and `scoresheet.css` so that pages not yet restyled
      read correctly on the new tokens in both schemes. No structural work.
      *Check*: AC-1.6 on Scorecards, Rules, About, Downloads, and Admin at 360 and 1440.
- [ ] **1.9 (S) Phase gate.** Run the gate and attach the Phase 1 screenshots of the shell
      on Home, which keeps its old content, at 1440 and 390 in both schemes.

---

## Phase 2: Home dashboard

**PR**: `feat(home): season dashboard — hero, KPIs, standings, news, calendar strip, award races`
**ACs**: AC-2.1 to AC-2.8.

- [ ] **2.1 (M) In-flight read de-duplication (OQ-8).**
  - Create `src/services/ttl-cache.ts`: `getOrLoad(key, loader, ttlMs)` shares a pending
    promise per key, caches successful `Result`s only, and supports `delete` and `clear`.
    Add `src/services/ttl-cache.test.ts`.
  - Modify `src/services/score-service.ts` to use it everywhere it currently calls
    `getCached`/`setCache`, keeping the existing keys and TTLs (1 h, and 5 min for
    `latest:`).
  - *Check*: AC-2.1; the existing `score-service.test.ts` passes unmodified;
    `score-service.ts` line count is < 742.
- [ ] **2.2 (S) Schedule utils (DD-8).**
  - Move `_applyOverrides` from `src/components/season-calendar.ts` to
    `src/utils/schedule.ts` as `applyWeekDateOverrides`, and add `nextShootEvent`.
  - Extend `src/utils/schedule.test.ts`.
  - *Check*: the calendar output is unchanged before the restyle; the new tests cover the
    AC-2.2 edge cases.
- [ ] **2.3 (M) Home view-model service.** Create `src/services/home-stats.ts` and
      `home-stats.test.ts`, holding pure functions for the DD-5 rows: leader and gap,
      league-average series, straight counts, the makeup-deadline descriptor, standings
      movement, gap, and form bars, and the calendar-cell states. The import rule is
      `@/types/*`, `@/services/standings`, `@/services/scoring-engine`, and `@/utils/*`.
      *Check*: every derivation has a test, including an empty season and week 1.
- [ ] **2.4 (M) `home-hero` component.**
  - Files: `src/components/home-hero.ts`, `src/styles/home.css`, `src/main.ts` (register).
  - The hero headline, lede, and CTAs. "Week N results" scrolls to standings per DD-4.
  - The next-shoot card handles every DD-7 state, with a progress bar of 15 segments and the
    makeup callout.
  - A skeleton card while loading.
  - *Check*: AC-2.2, AC-G10; matches Main/HomeMobile at 1440 and 390.
- [ ] **2.5 (M) `season-kpis` component.**
  - Files: `src/components/season-kpis.ts`, `src/styles/home.css`.
  - Four tiles on desktop (overlapping the hero by 64px), a 2×2 grid on mobile.
  - An accessible SVG sparkline.
  - The Top Gun tile follows OQ-1: it comes from `season.awards` when the season is
    complete, from the race when OQ-1 is approved, and is dropped otherwise.
  - *Check*: AC-2.3; the tiles share cached reads (the 2.1 test plus a manual read count).
- [ ] **2.6 (L) Standings restyle.**
  - Files: `src/components/home-standings.ts` (render only; the view-model comes from 2.3),
    `src/styles/home.css` or `tables.css`.
  - Position badge, movement, gap, and form bars in a `.table-scroll` region.
  - The compact mobile column set below 640px, following DD-5 and HomeMobile.
  - Leader row tint.
  - Accolades as chips, and season awards restyled as cards.
  - An "After Week N" heading and a "Full scorecards →" link to `#/scorecards`.
  - A skeleton reshaped to the new row structure.
  - *Check*: AC-2.4; `home-standings.ts` is under 500 lines; the historical-week view is
    unchanged in values (compare with `main` for 2 historical seasons).
- [ ] **2.7 (M) Announcements and calendar strip.**
  - `src/components/home-announcements.ts`: the three most recent posts as cards, each
    with the month/day block.
  - `src/components/season-calendar.ts`: rewrite the renderer to the 16-cell strip, keeping
    the component name and tag.
  - `src/styles/home.css`.
  - *Check*: AC-2.5, AC-2.6; no horizontal page overflow at 360 (the strip scrolls
    internally); escaped titles; the markdown body goes through `renderMarkdown` only.
- [ ] **2.8 (M) Award candidates in the engine. Gate: OQ-1 and OQ-2.**
  - `src/services/scoring-engine.ts`: add `rankAwardCandidates` and refactor
    `computeSeasonAwards` onto it (DD-6).
  - `src/services/season-awards-service.ts`: add `previewAwardRaces`.
  - Extend `scoring-engine.test.ts` and `season-awards-service.test.ts` with parity and
    tie fixtures.
  - Invoke `@scoring` to review.
  - *Check*: all existing award tests pass unmodified; the winner-parity test passes;
    `scoring-engine.ts` stays under 750 lines (555 now).
- [ ] **2.9 (M) `award-races` component. Gate: OQ-1.**
  - Files: `src/components/award-races.ts`, `src/styles/home.css`.
  - Lazy-load with an `IntersectionObserver` (disconnected on teardown).
  - A skeleton of three cards with three rows each.
  - The "Eligible after 6 nights" empty state.
  - Renders only for an in-progress latest season.
  - *Check*: AC-2.7; zero award-race reads until the section scrolls into view (emulator
    read count).
- [ ] **2.10 (S) Home composition and the first-Tuesday card.**
  - File: `src/views/home.ts`. Order: hero → KPIs → standings → (news | first-Tuesday
    card) → calendar → award races.
  - The first-Tuesday card is static markup. Its copy is checked against About and Rule
    2.2, and its CTA follows OQ-3.
  - *Check*: AC-2.8; the section order matches Main and HomeMobile.
- [ ] **2.11 (S) Phase gate.** Run the gate, plus a Firestore read count for a cold Home
      load compared with the 0.2 baseline (AC-G11), plus Lighthouse on Home in both schemes.

---

## Phase 3: Scorecards

**PR**: `feat(scorecards): team tabs, summary strip, heat-grid scorecard, mobile shooter cards`
**ACs**: AC-3.1 to AC-3.5.

- [ ] **3.1 (M) Scorecard summary service.** Create `src/services/scorecard-summary.ts`
      and `scorecard-summary.test.ts`, with `heatBin`, the team-summary metrics (DD-5), the
      team ordering by place, and the last-published-week helper.
      *Check*: the AC-3.3 boundaries and the AC-3.2 derivations are tested.
- [ ] **3.2 (L) `season-scorecards` rewrite.**
  - Files: `src/components/season-scorecards.ts`. If the file approaches 500 lines, move
    the rendering helpers into `src/components/scorecards/heat-grid.ts` (a
    render-string-only module).
  - Season chips or a select, and team tabs following the APG pattern.
  - All panels are rendered, with inactive ones `hidden`.
  - The dark summary strip.
  - The heat grid in `.table-scroll`, with a sticky first column, legend, and accessible
    cell names.
  - The totals rows.
  - Mobile shooter cards and the team-by-week table.
  - A skeleton of chips, tabs, the strip, and grid rows.
  - Keep the `_loadGen` guard, and use `escapeHtml` for all names.
  - *Check*: AC-3.1 to AC-3.4; matches Scorecards and ScorecardsMobile.
- [ ] **3.3 (S) Scorecards styles.** Add `src/styles/scorecards.css` (heat classes
      referencing `--c-heat-*` only; chips; tabs; strip) and retire the unused
      `.collapsible`/`.scorecard` rules from `tables.css` once no other consumer remains
      (grep).
      *Check*: AC-G5 (no hex outside the tokens).
- [ ] **3.4 (S) Print.** Update `src/styles/print.css` for the new markup: show every panel,
      use a grayscale grid, and hide the chips, tabs, and nav.
      *Check*: AC-3.5 in the Chrome print preview for a 15-week historical season and for
      the current season.
- [ ] **3.5 (S) Phase gate.** Run the gate, plus Lighthouse on Scorecards in both schemes,
      plus an overflow check at 360 with the widest historical season.

---

## Phase 4: Rules, About, Downloads

**PR**: `feat(rules): numbered rule cards, sticky TOC, mobile accordion; restyle About/Downloads`
**ACs**: AC-4.1 to AC-4.4.

- [ ] **4.1 (M) Rules restructure.**
  - Files: `src/views/rules.ts`, `src/styles/rules.css`.
  - The dark hero.
  - At-a-glance tiles, each with its rule reference.
  - Six `<section>` cards with number badges, each wrapping its rule list in
    `<details open>`/`<summary>`.
  - The makeup example strip.
  - The ladder built from `computeRankPoints` over 8 distinct targets.
  - The yardage grid from `YARDAGE_TABLE`.
  - The trophy cards.
  - Keep `id="scoring-and-yardage"`, and **do not edit any rule wording**.
  - *Check*: the 0.3 snapshot test passes (AC-4.1); the tile copy is reviewed against the
    cited rules (note this in the PR).
- [ ] **4.2 (M) `rules-toc` component.**
  - Files: `src/components/rules-toc.ts`, `src/main.ts` (register).
  - The sticky TOC with active-section tracking (`IntersectionObserver`).
  - Scroll and focus per DD-4, without changing the hash.
  - `matchMedia('(min-width: 960px)')` switches between the always-open and accordion
    modes.
  - The "Print rules" button.
  - Full teardown.
  - *Check*: AC-4.3; `location.hash` stays `#/rules` throughout.
- [ ] **4.3 (M) About and Downloads restyle.**
  - Files: `src/views/about.ts`, `src/views/downloads.ts`, `src/styles/about.css`,
    `src/styles/scoresheet.css`, `src/components/yardage-table.ts` and
    `src/components/scoresheet-generator.ts` (class and markup changes only; no logic).
  - Page headers, prose cards, the map card (the iframe `src` is unchanged), and the
    generator and yardage cards.
  - *Check*: AC-4.4; the print buttons still isolate their sections.
- [ ] **4.4 (S) Phase gate.** Run the gate, plus Lighthouse on Rules in both schemes, plus
      print previews of the rules, the scoresheets, and the yardage table.

---

## Phase 5: Admin app shell, then close-out

**PR 5A**: `feat(admin): sidebar app shell, score-entry restyle, live calculation panel`
**PR 5B** (may be folded into 5A): `docs: constitution 1.7.0, ADR-011, budgets, scoring-rules yardage`
**ACs**: AC-5.1 to AC-5.6.

### 5.A Admin

- [ ] **5.1 (M) Shell.**
  - Files: `src/components/admin-panel.ts`, `src/views/admin.ts` (layout wrapper; same IDs),
    `src/styles/admin-shell.css`, `src/main.ts` (optional role label through `textContent`).
  - The sidebar nav with the five `data-tab` entries and `aria-current`.
  - The top bar with the page title and year select.
  - The mobile drawer with `aria-expanded`, Escape to close, and teardown.
  - `admin-panel { display: contents }` grid placement.
  - The `:has()` chrome hiding (DV-7).
  - *Check*: AC-5.1, AC-5.2; sign-in, unauthorized, and sign-out flows still work; the
    lazy mount/unmount on role change still fires `disconnectedCallback`.
- [ ] **5.2 (M) Extract the date card.** Move the date-override card
      (`_updateDateSection`, `_saveDateOverride`, and their state) from
      `src/components/admin-tabs/score-entry-tab.ts` into
      `src/components/admin-tabs/score-entry-date-card.ts`, as a class that the tab owns,
      with its behavior unchanged. It uses `applyWeekDateOverrides` where applicable.
      *Check*: the lock, edit, cancel, past-date, and scores-present cases behave as on
      `main` (manual emulator run); `score-entry-tab.ts` shrinks.
- [ ] **5.3 (S) `lookupYardage`.** Add it to `src/utils/yardage.ts` (DD-12a), with a new
      `src/utils/yardage.test.ts`.
      *Check*: every boundary is tested.
- [ ] **5.4 (M) Live preview service.** Create `src/services/score-entry-preview.ts` and
      `score-entry-preview.test.ts`: `previewTeamNight()` composes
      `buildSeasonData`, `computeSeasonTotals`, `computeGoingInAverageSum`,
      `computeTargetBonus`, `computeRookieBonus`, `computeGoingInAverage`, and
      `lookupYardage` (DD-12). It returns plain data, including per-shooter going-in
      averages for the GOING-IN column.
      *Check*: AC-5.4 parity with `computeSeasonTotals`; `@scoring` review.
- [ ] **5.5 (L) Score-entry restyle.**
  - Files: `src/components/admin-tabs/score-entry-tab.ts`, the new
    `src/components/admin-tabs/score-entry-calc.ts` (presentational panel, built with
    `textContent`), and `src/styles/admin-shell.css` or `admin-tables.css`.
  - Team chips as a radiogroup with status from the fetched entries, and the draft pill.
  - The GOING-IN column.
  - The Publish button in the top bar.
  - The calc panel, updated with a debounce, and labeled as a preview.
  - Mobile shooter cards with 48px steppers that write to the same `.ap-score-input`
    elements, clamped to 0–25.
  - A sticky mobile footer.
  - *Check*: AC-5.3 argument parity for `saveEntry`/`publishWeek`; AC-5.5 line counts
    under 500; matches Admin and AdminMobile at 1440 and 390.
- [ ] **5.6 (M) Other tabs.** Restyle Team Management, Announcements, Season End, Users,
      the roster modal, and the confirm dialog through the shared admin CSS (cards, tables
      in `.table-scroll`, 44px controls). No markup-logic changes beyond class names.
      *Check*: every tab is usable at 360 and 1440 in both schemes, and every action
      behaves as on `main`.
- [ ] **5.7 (S) Phase 5A gate.** Run the gate, plus an emulator save → publish run. The
      resulting documents match a `main` run with the same inputs (AC-5.3).

### 5.C Documentation and constitution close-out

- [ ] **5.C1 (S)** `.specs/constitution.md`:
  - §IV.1 Styling line: self-hosted `@fontsource` fonts under `font-src 'self'`, the
    "Range Day" token groups, and the heat ramp.
  - §III.3: the skeleton utilities now live in `src/styles/skeleton.css`, not `main.css`.
  - §III.4: add the font-payload budget and a reference to the CSS budget, and reconcile
    the JS figure with the measured build.
  - §II.1: recount the components and services from `src/`.
- [ ] **5.C2 (S)** `.specs/constitution.md`: add **§III.6 Accessibility & Responsive
      Standards**, per OQ-6. Add a checklist line to §VIII.2. Bump the version to 1.7.0,
      update the date, and add a version-history entry.
- [ ] **5.C3 (S)** `src/styles/tokens.css`: remove the legacy `--c-nav-*`, `--c-table-*`,
      and `--c-collapsible-*` aliases once `grep -rn "var(--c-\(nav\|table\|collapsible\)-" src/`
      finds no consumers.
- [ ] **5.C4 (S)** `.specs/technical/build-system.md`: update the budget table with the
      measured JS, CSS, and fonts figures, and document the fontsource asset output.
- [ ] **5.C5 (S)** `.prompts/meta/architectural-decision-log.md`: add **ADR-011 "Range Day"
      redesign and self-hosted fonts**. Include the context, the DD-2 §IV.3 evaluation, the
      consequences, and the note that it supersedes ADR-008's brand-strip and nav
      specifics.
- [ ] **5.C6 (S)** `.specs/domain/scoring-rules.md`: add a Yardage section (rule 5.7,
      `YARDAGE_TABLE`, and the `lookupYardage` rounding and clamping). Also note that the
      admin live preview and the award races are read-only compositions of the documented
      rules.
- [ ] **5.C7 (S)** Remaining docs:
  - `CLAUDE.md` Key Files: the new services, utils, and components, and a correct
    `lookupYardage` description.
  - `src/components/README.md`, only if a contract clarification arose (for example,
    `IntersectionObserver`/`matchMedia` teardown under item 3).
  - `.specs/README.md` status, then move this spec directory to `features/archive/`
    after the final PR merges.
- [ ] **5.C8 (S) Final gate.** Run the full gate plus `npm run test:rules`. Invoke
      `@reviewer` on the branch; its constitutional checks must pass.

---

## Stretch (optional; each needs its own task, and the global ACs apply)

- [ ] S-1 Home results ticker.
- [ ] S-2 Admin "Week N rank preview", using the 5.4 draft pass plus `computeRankPoints`.
- [ ] S-3 Admin "Needs attention".
- [ ] S-4 Admin "Save & next team".
- [ ] S-5 Rules search.
- [ ] S-6 The Scorecards chart and highlights.
- [ ] S-7 The Scorecards "Yardage" metric.
- [ ] S-8 The Home venue card.
