# Responsive K/Q Matchups — November 18, 2026

## Implemented

Desktop retains paired team cards, centered inside a 950px maximum matchup area. Cards expand moderately up to 430px each, separated by a 20px gap. Reduced selector/heading/card and inter-matchup whitespace; subtle dividers remain. Player lists now use proper list containers with no bullets, consistent left alignment, natural name wrapping, and the original blue/pink backgrounds and yellow Sub badges.

At 767px and below, a compact matchup container replaces the stacked full cards. Two team headings show recorded round-win counts when Boolean outcomes are available. A Round / Team N / Team N table compares original saved scores side by side, followed by two compact roster columns. Original WON flags alone determine green highlighting; numeric scores never infer a winner. Unknown outcomes say Result not recorded; absent saved score rows display an em dash; actual saved zero remains zero. Ties recorded as false receive no WON label. Summary counts do not change historical outcomes or calculations.

Existing desktop/mobile back buttons, week selector, bye players, exact-match filtering, original match numbers, highlighted round, View All Matchups, manual week changes and refresh behavior remain. No route, pairing, lookup, persistence, ranking, scoring, substitute or backend API changes were made. New TypeScript methods only project saved rounds for display and count existing true flags. Duplicate round records are retained rather than silently discarded.

## Verification

Angular development build passed, using installed Angular 7 dependencies and the existing Node runtime. Existing outdated Browserslist warning remains. Log: artifacts/kq-matchups-responsive-build.log.

Four focused browser workflow groups passed, with no page errors or write requests:

1. Normal week browsing, deterministic existing saved-ID ordering, original Match 1/2, pair/player association, bye players, colors, Sub badge and original scores. Desktop 1366/1920 and phones 375/390/430 have no horizontal page overflow; desktop cards remain side by side and mobile scores appear together. Tied-round flags remain unmarked; unknown outcomes and original zero scores are preserved. A deliberately contradictory score/win fixture confirms saved flags, rather than numeric comparisons, control WON.
2. Standings-format deep link to original Match 2, exact saved team/player and round highlight; direct refresh, View All Matchups and Back to Standings preserve league/mode/gender/division parameters.
3. Actual player-profile round-score link, automatic correct week/team, refresh, Back to Player Profile, and a manual week change resetting to all matchups. Two saved weeks share the same calendar date to ensure date alone does not select identity.
4. Unavailable requested team refuses to show unrelated matchups; missing opposing round records show unavailable values rather than fabricated scores or wins.

Tests used localhost with intercepted read-only APIs and synthetic browser fixtures. No SQL connection, development mutation authorization, production access, database reads/writes, credentials, email or cleanup was involved. These are grouped checks, not a full functional regression run. Database-backed live-response reconciliation and clicking through the actual standings UI were not executed in this pass; the standings deep-link URL contract was tested directly. The actual player-profile click was executed. No backend build was needed because backend source is unchanged.

## Screenshots

- [Desktop full page and selector](player-profile-evidence/kq-page-1366.png)
- [Desktop multiple matchups](player-profile-evidence/kq-responsive-1366.png)
- [Large desktop](player-profile-evidence/kq-responsive-1920.png)
- [Mobile full page and selector](player-profile-evidence/kq-page-390.png)
- [Mobile comparison, rosters and Sub badge](player-profile-evidence/kq-responsive-390.png)
- [375px mobile](player-profile-evidence/kq-responsive-375.png)
- [430px mobile](player-profile-evidence/kq-responsive-430.png)
- [From player profile](player-profile-evidence/kq-from-profile-mobile.png)
- [From standings-format score link](player-profile-evidence/kq-from-standings-mobile.png)

Results: player-profile-evidence/kq-responsive-results.json. All screenshots contain synthetic fixture data.

## Repeat

With the existing local application serving the development Angular bundle:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tests/functional/.tools/browsers'
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/player-profile-ui.cjs --kq-responsive
```

## Changed files and boundaries

Application changes only: ClientApp/src/app/kqmatchups/kqmatchups.component.html, .css and .ts. Test changes: tests/functional/scripts/player-profile-ui.cjs plus this report, WORK_LOG.md, generated screenshots and JSON results. Existing uncommitted player-statistics changes were preserved.

Authentication, roles, shared legacy password, saved records, team pairing algorithms, database schema, APIs, league management, production configuration, IIS, Cloudflare and deployment settings were not modified. No packages installed; no publish, deploy, commit, push or merge.