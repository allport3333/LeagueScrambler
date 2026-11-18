# Final mobile standings refinements — 2026-11-17

Later requested settings collapse and equal-column alignment supersede the fixed 48px detail column below. See [STANDINGS_SETTINGS_REPORT.md](STANDINGS_SETTINGS_REPORT.md) for current behavior and evidence.

Completed the requested adjustments without redesigning the compact table.

## Changes

- Expanded mobile score entries use a fixed 48px numeric column with centered values. Round/matchup labels remain left aligned; indicator text wraps compactly in its own column. Existing red dropped/reduced and purple substitute styling is retained.
- Removed Total Wins from mobile expanded details only. Desktop Total Wins columns and all calculations remain unchanged. The existing Total Wins sorting option remains available, as requested by preserving the sorting controls.
- Desktop, mobile expanded details and mobile View Full Table now display chronological columns from 1 through the last round/matchup.
- Mobile Division information appears only when a positive assigned division ID and nonblank division code exist. Zero/null/missing IDs or codes, blank labels and the API's Unassigned sentinel do not produce a Division label/value.
- Mobile-only spacing is tighter around the card, toggle, legend and tabs. The sort field is followed by one shared row containing direction and full-table buttons. The compact-mode instructional paragraph is removed. Buttons/player expansion targets retain at least 44px height, as do the division/gender tabs.

At both tested widths, the compact table is **170px higher** and **16px wider** than the immediately preceding design. At 375px, its top moved from 657.69px to 487.63px in the same synthetic Player presentation. See [spacing measurements](mobile-standings-refinements-evidence/spacing-comparison.json).

## Why the ordering is correct

Read the existing ScrambleDataController projections rather than assuming reversing the display is safe:

- GetByLeague builds a complete normalized score entry for every valid `(ScrambleNumber, RoundId)` and explicitly orders that array by scramble number, then round ID.
- GetByLeagueMatchup orders scramble numbers, assigns sequential display RoundIds (`index + 1`), and returns normalized scores in scramble-number order.
- LeagueStandingsComponent transforms score copies without reordering their array; its score-sorted copy is used only to mark drops.

The old HTML reversed both headers and score cells. Removing those display reversals restores the API's chronological order. No array is sorted or mutated for this change. Because raw round IDs can repeat across scrambles, mobile labels use the same 1-based chronological position as the desktop headers, rather than presenting repeated raw round IDs as global round numbers. Each score object and its dropped/reduced/substitute flags stay together.

## Verification

**9 focused Chromium browser check groups passed, 0 failed.**

- Desktop at 1366×768 and 1920×1080: measured geometry, fonts, spacing, tabs, colors and score attributes match the pre-refinement baseline, allowing only ascending score-column contents.
- Mobile at 375×667 and 390×844: no page overflow; existing compact values and colors retained; player rows expand using taps and keyboard.
- Every displayed round/matchup score was checked independently against the synthetic API payload's chronological position, including 11 entries with repeating raw round IDs across scrambles. Scores were also compared between desktop/full-table cells and mobile details. Reduced, dropped and substitute indicators remain associated correctly.
- Centered numeric columns have identical centers and 48px widths across every expanded entry.
- Assigned Gold division is retained; Unassigned, null, missing and blank division variants omit the entire label/value. Mobile Total Wins text is absent.
- Four sort keys/direction, Overall/Gold/Silver/Bronze, both genders, Round/Matchup, full-table scrolling/sticky names and return to desktop passed.
- Mobile control/row targets remain at least 44px, with no truncated control contents. The test tolerates one pixel of fractional-grid scroll/client rounding.

Angular development and production/AOT builds passed using the existing Node 10 and installed dependencies. Only the existing outdated Browserslist/caniuse-lite warning was reported. No framework/package changes. The full regression suite was not rerun; this pass did not repeat the earlier math tests or claim a new database-backed regression baseline.

The actual local Angular application was rendered using **browser-only synthetic display fixtures**. Every API GET was intercepted, all API writes and external URLs were blocked, and no SQL/database access, account authentication experiment or production operation occurred. Final browser page errors and attempted API writes: zero. [Final results](mobile-standings-refinements-evidence/results.json).

Evidence is Chromium at emulated sizes, not physical-device Safari/VoiceOver testing. External font requests are blocked by the fixture harness; existing Material icon fallback text can appear in desktop screenshots. No desktop font or icon code was changed.

## Screenshots

- [Mobile compact, 375×667](mobile-standings-refinements-evidence/mobile-375x667-compact.png)
- [Mobile compact, 390×844](mobile-standings-refinements-evidence/mobile-390x844-compact.png)
- [Mobile expanded, 375×667](mobile-standings-refinements-evidence/mobile-375x667-expanded.png)
- [Mobile expanded, 390×844](mobile-standings-refinements-evidence/mobile-390x844-expanded.png)
- [Mobile full table with sticky names](mobile-standings-refinements-evidence/mobile-full-table.png)
- [Desktop Matchup 1–11](mobile-standings-refinements-evidence/desktop-1920x1080-matchup-ascending.png)
- [Desktop 1366×768 after](mobile-standings-refinements-evidence/desktop-1366x768-after.png)
- [Desktop 1920×1080 after](mobile-standings-refinements-evidence/desktop-1920x1080-after.png)
- [375px before spacing refinement](mobile-standings-refinements-evidence/mobile-375-before.png)

Original preceding feature evidence remains preserved in mobile-standings-evidence. This pass has its own pre-refinement baseline and screenshots in mobile-standings-refinements-evidence.

## Files changed in this refinement pass

Application files only:

- `ClientApp/src/app/league-standings/league-standings.component.html`: ascending display loops and labels, mobile summary conditions and compact toolbar grouping.
- `ClientApp/src/app/league-standings/league-standings.component.css`: mobile-only spacing, touch targets and centered detail score grid.

Testing/documentation:

- `tests/functional/scripts/mobile-standings.cjs`: updated ordering expectations, independent 11-score association checks, division variants, control sizing and spacing comparison.
- `tests/functional/mobile-standings-refinements-evidence/`: new baseline, screenshots and results.
- `tests/functional/MOBILE_STANDINGS_REFINEMENTS.md`: this report.
- `tests/functional/MOBILE_STANDINGS_REPORT.md`: pointer to this final refinement report.
- `tests/functional/WORK_LOG.md`: completion entry.

The component TypeScript, score calculations, API responses/backend, database/schema, authentication, administrator logic and desktop spacing CSS were not edited in this pass. Existing unrelated pending Team Scores/UX work was preserved. No production, IIS, Cloudflare, publish, deploy, commit, push or merge operations.

Rerun focused checks with the existing development app running:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/functional/Run-MobileStandings.ps1
```

This sets execution policy only for the child process, uses the existing portable testing runtime, restores scoped environment variables and requires no SQL authorization. Do not overwrite the stored pre-refinement baseline. Work stops at these refinements.
