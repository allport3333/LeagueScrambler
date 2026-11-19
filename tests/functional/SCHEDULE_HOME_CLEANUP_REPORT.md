# Full Schedule, Schedule Navigation and Home Cleanup

## What changed

- Full Schedule now displays each matchup once: centered team name | v | centered team name. There are no misleading Team/Opponent headings or duplicate description rows.
- Weekly tables group Gold, Silver, Bronze and other divisions consistently. Original order is retained within each division. Small division headings replace repeated division labels. Special-event descriptions are retained once per week; ordinary pairing descriptions are suppressed by a shared presentation helper, also used by Next Game.
- League/season appears once in the viewer header. Weekly tables remain chronological, two per desktop row and one on phones. Current-week highlighting remains subtle.
- Printing uses a dedicated compact A4 portrait style, two weekly tables per row, 8mm margins and 11px matchup text. Weekly sections avoid page breaks. The printed season title appears once; no navigation, modal controls or buttons are included. The print document now explicitly uses standards mode and inherits the intended table font, avoiding oversized default table text.
- Schedule uses the existing previous/dropdown/next navigator plus Current Week and Full Schedule. The duplicate date picker and its unused presentation state were removed. These controls share a desktop row and wrap on phones. Existing closest-date logic, explicit week links, retrieval, request deduplication and detailed matchup cards are preserved.
- Home's generic top shortcut row and bottom administration shortcut row were removed. Contextual schedule, standings and game-history links remain, including the latest K/Q score. Next Game, self-attendance, upcoming schedule, standings and recent results retain their order. Cards no longer stretch an empty column to match a taller neighbor.
- An existing 85px mobile body spacer was still applied to Home despite the navigation being in normal document flow. A Home-only route class now uses 6px padding, following the existing profile/standings approach. Other page spacing is unchanged.

## Verification

- Angular development build passed: `artifacts/schedule-cleanup-build.log`.
- Focused browser fixture checks passed, with no page errors: `schedule-cleanup-evidence/results.json`.
- Verified week dropdown selection, first/last boundaries, Current Week, gaps between scheduled dates, correct detailed matchup count, manual selection across dashboard tabs and no duplicate schedule requests.
- Verified 14 weeks and all 84 matchup rows, grouped divisions, one season title, retained tournament description and current-week highlight.
- Schedule controls checked at 1366, 1920, 375, 390 and 430px. Full Schedule and Home checked at desktop and 375/390/430px, including contained modal scrolling, mobile overflow and removal of Home's legacy spacer.
- Verified league switch clears the open season viewer, and explicit week links survive refresh.
- Verified Home retains next-game/attendance components, upcoming games, standings and team/KQ recent results; contextual profile link preserves player ID, selected league and K/Q tab. Existing global permitted routes remain available.
- Generated PDF evidence: the same synthetic **14-week/84-matchup season fits on one A4 portrait page**, including its special event. A reconstructed previous layout with the same fixture used **seven pages**. Weekly tables are intact in the one-page output.

All application API traffic was intercepted with browser fixtures; no database reads or writes were performed. No backend, authentication, attendance rules, schedule storage or calculations changed. No full regression suite was run. Real-account attendance mutations were not retested because this change only preserves the existing attendance component. Actual page counts can increase for longer seasons or significantly longer names; no arbitrary scaling hides or truncates games. Browser-added print headers/footers and printer settings can also affect pagination.

## Evidence

- [Desktop Full Schedule](schedule-cleanup-evidence/full-schedule-1366.png)
- [Mobile Full Schedule](schedule-cleanup-evidence/full-schedule-390.png)
- [Desktop schedule controls](schedule-cleanup-evidence/schedule-controls-1366.png)
- [Mobile schedule controls](schedule-cleanup-evidence/schedule-controls-390.png)
- [Mobile Home](schedule-cleanup-evidence/home-390.png)
- [Desktop Home](schedule-cleanup-evidence/home-1366.png)
- [One-page season PDF](schedule-cleanup-evidence/season-14-weeks.pdf)
- [Previous layout PDF, same fixture](schedule-cleanup-evidence/season-before-same-fixture.pdf)

No publishing, deployment, commits, pushes, merges or production changes.
