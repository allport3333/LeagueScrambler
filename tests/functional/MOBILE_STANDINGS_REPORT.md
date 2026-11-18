# Mobile Player Standings — completed 2026-11-17

The original implementation report below is historical. The later requested ordering, summary and spacing changes are documented in [MOBILE_STANDINGS_REFINEMENTS.md](MOBILE_STANDINGS_REFINEMENTS.md), with current screenshots, verification and rerun instructions.

## Result

Below 768 CSS pixels, the existing LeagueStandingsComponent now shows a compact four-column table: Place, Player Name, King Queen Score and Total Points. Tap anywhere in a player row, or use its keyboard-accessible name button, to expand total wins, division and individual round/matchup scores. The existing light-blue ranking, light-green KQ score, red dropped/reduced and purple substitute meanings are retained. Expanded entries also carry text indicators, so their meaning does not rely on color alone.

Mobile sorting supports Player Name, King Queen Score, Total Points and Total Wins, with an explicit direction toggle. It invokes the existing sorting implementation. Overall, configured division tabs and gender tabs are reused unchanged, as is the Round/Matchup switch. View Full Table exposes the original detailed table in its own horizontal scrolling region with sticky player names; View Compact Table returns to the compact view.

Normal desktop screens keep the original table, tabs, legends, controls, colors, fonts, spacing and sorting interactions. The new full-table wrappers use `display: contents` on desktop; the mobile markup is hidden. All original four detailed table blocks are text-identical to HEAD after line-ending normalization, all original CSS rules remain intact, and the original component implementation is unchanged apart from an added presentation-state/helper block. No scoring, ranking, substitute/drop calculations, API, authentication or backend changes were made for this feature.

## Verification actually executed

| Verification | Result |
|---|---|
| Angular development build, existing Node 10/packages | Passed |
| Angular production/AOT build, existing packages | Passed |
| Desktop 1366 × 768 | Before/after PNG files byte-identical; table geometry, text, fonts, colors, padding and tabs identical |
| Desktop 1920 × 1080 | Same comparison passed |
| Mobile 375 × 667 | Passed: four columns, no page overflow, values/indicators, tap/keyboard expansion |
| Mobile 390 × 844 | Same checks passed |
| Mobile 430 × 932 | Same checks passed |
| Four mobile sort keys and direction | Passed; matched original table data after sorting |
| Overall, Gold, Silver, configured Bronze and both genders | Passed; correct filtered arrays |
| Round/Matchup switching | Passed; original values and detail labels matched |
| Full table, internal horizontal scrolling, sticky names, compact return | Passed |
| Resize back to desktop | Passed; only original full-table presentation visible |
| Existing focused standings-math tests | 3 passed, 0 failed |
| Full functional suite | Not rerun; unnecessary for this presentation-only change |

The focused presentation runner completed **9 check groups, all passed**, with zero API write attempts and zero browser page errors. These are browser checks, not nine additional Playwright test-runner cases. The three existing math tests ran separately through Playwright. The original four-table/source/CSS preservation assertions also passed; see [source-preservation.json](mobile-standings-evidence/source-preservation.json).

During implementation, the presentation runner's settings response shape and Angular 7 Material tab/selector handling were corrected. Color comparison also exposed a default-text-color difference, fixed only within mobile markup. A stale built development bundle initially hid that CSS update; the development build was regenerated before final verification. These issues are resolved; no final verification failures remain. Obsolete debugging captures are archived outside the screenshot collection.

Build warning: Browserslist/caniuse-lite data is outdated. No dependencies were installed or upgraded. Existing framework/runtime versions were preserved.

## Evidence and limits

Tests rendered the actual updated Angular application at https://localhost:5001 in Chromium using **browser-only synthetic display fixtures**. Every API GET was intercepted, non-GET requests were blocked, and external URLs were blocked. No database connection, account creation, administrator authentication experiment, password recovery or testing authorization renewal occurred. Desktop screenshots model existing administrator settings; mobile screenshots model the Player presentation after applying the same client-side scoring settings to synthetic data. No real user information appears.

Every visible primary cell was compared with the corresponding original detailed-table cell. Expanded score values and red/purple indicators were compared with the original table's actual rendered values/styles. One substitute score was reduced and dropped; the textual indicators explicitly show both states. Tests also exercised long player names.

This verifies responsive Chromium rendering, not physical-device Safari/VoiceOver or Android TalkBack. It does not revalidate database-backed scoring or claim a new complete regression baseline. The historical full-suite baseline remains 36 passed / 0 failed / 2 accepted blocked.

## Screenshots

| Screen | Evidence |
|---|---|
| Desktop 1366 × 768, original | [Before](mobile-standings-evidence/desktop-1366x768-before.png) |
| Desktop 1366 × 768, updated | [After — identical](mobile-standings-evidence/desktop-1366x768-after.png) |
| Desktop 1920 × 1080, original | [Before](mobile-standings-evidence/desktop-1920x1080-before.png) |
| Desktop 1920 × 1080, updated | [After — identical](mobile-standings-evidence/desktop-1920x1080-after.png) |
| Mobile 375 × 667, expanded | [Screenshot](mobile-standings-evidence/mobile-375x667-expanded.png) |
| Mobile 390 × 844, expanded | [Screenshot](mobile-standings-evidence/mobile-390x844-expanded.png) |
| Mobile 430 × 932, expanded | [Screenshot](mobile-standings-evidence/mobile-430x932-expanded.png) |
| Mobile By Matchup | [Screenshot](mobile-standings-evidence/mobile-matchup.png) |
| Mobile full table, horizontally scrolled | [Screenshot](mobile-standings-evidence/mobile-full-table.png) |

Screenshots are full-page captures at the stated viewport sizes. The source baseline is preserved in desktop-baseline.json; [results.json](mobile-standings-evidence/results.json) lists the final nine passing groups and the no-write provenance. Existing math results: [summary](artifacts/runs/mobile-standings-math/summary.md).

## Files changed for this feature

- `Allport's League Scrambler/ClientApp/src/app/league-standings/league-standings.component.ts`: presentation state, expansion helper and mobile sorting adapter only.
- `Allport's League Scrambler/ClientApp/src/app/league-standings/league-standings.component.html`: shared mobile template, per-tab outlets and wrappers around unchanged original tables.
- `Allport's League Scrambler/ClientApp/src/app/league-standings/league-standings.component.css`: mobile styling and desktop-neutral visibility rules.
- `tests/functional/scripts/mobile-standings.cjs`: no-write fixture browser verification and screenshot comparison.
- `tests/functional/Run-MobileStandings.ps1`: portable Node 22 runner; restores environment variables without replacing system Node 10.
- `tests/functional/mobile-standings-evidence/`: before/after/mobile screenshots, baseline and assertion evidence.
- `tests/functional/MOBILE_STANDINGS_REPORT.md`: this report.
- `tests/functional/WORK_LOG.md`: completion entry.

Pre-existing Team Scores and UX audit changes were preserved, not overwritten. No production, IIS, Cloudflare, database, publish-profile, dependency, commit, push, merge or deployment changes occurred.

## Rerun only the focused verification

With the existing development application running and the Angular development bundle built:

```powershell
.\tests\functional\Run-MobileStandings.ps1
.\tests\functional\Run.ps1 -Mode readonly -TestFilter 'standings math' -ReportLabel mobile-standings-math
```

The presentation runner uses the existing isolated portable Node 22/Playwright installation. It requires no SQL access or mutation grant. Do not regenerate or overwrite the original desktop baseline when checking future changes. No further feature work is started.
