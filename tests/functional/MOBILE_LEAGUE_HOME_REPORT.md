# Mobile League Standings and K/Q Home Summary

Implemented the three requested changes without backend/API/schema changes.

## Changes

1. **League Dashboard standings:** below the existing desktop XL layout (1200px), division tables are replaced by compact stacked team rows. Row one shows the existing rank and full team name; row two shows Wins, Losses and Total Points, wrapping as needed. Both layouts use the same `divisions` arrays and existing ranks. Gold/Silver/Bronze heading colors remain. The swipe instruction is removed. No overflow hiding is used to substitute for missing content. The desktop Material table columns, cells, row styling and data bindings remain intact.
2. **Home ordering:** the existing Latest King/Queen Score block now appears immediately above Recent Game Scores, inside the existing results panel. Latest historical score, date, round wins, history links and regular league-team results remain unchanged. Only the block order and separating border changed.
3. **Current Standing:** Home loads the selected league's existing standings settings and appropriate round/matchup standings response. It identifies the linked authenticated player by PlayerId. The page's existing score transformation was moved unchanged to a shared pure function used by both Home and LeagueStandingsComponent. No second ranking formula was introduced.

### Ranking meaning

The existing K/Q page has separate Men's and Women's Overall lists, plus assigned division tabs. Home therefore labels the main rank **Overall Men's** or **Overall Women's**, with the configured By Round/By Matchup mode. It displays ordinal position and participant count from that same ordered gender list, and the assigned division's position/count below it when applicable. It does not combine men and women into a new ranking. The Current Standing link opens the matching Overall/gender/mode on the existing K/Q page.

The existing page assigns sequential positions using list index + 1; Home preserves that behavior, including existing tie-breakers. Substitute percentages, permitted substitute scores, dropped scores, raw historical scores and rankings are unchanged. A zero-score player present in the standings is still ranked exactly as on that page. An absent player displays **Not yet ranked**; loading and request errors have distinct messages. Unlinked accounts have no K/Q results/standing panel. League changes clear/cancel prior ranking requests and stale responses are ignored.

## Verification performed

- Angular development build passed: `artifacts/mobile-league-home-build.log`.
- Backend Release build passed, zero errors: `artifacts/mobile-league-home-backend-build.log`. Existing legacy dependency warnings remain; no backend source was changed for this task.
- **72 fixed ranking regression cases passed:** round/matchup modes, varied drop counts, substitute allowances and percentages, zeros, duplicate names and division metadata. Adjusted scores, totals, wins, original-score totals, reduction/drop flags and order match captured pre-refactor expected values. Inputs and saved score/team identities remain unchanged. The frozen test fixture is independent of Git HEAD for future runs.
- **Five focused browser check groups passed**, no page errors: `mobile-league-home-evidence/results.json`.
- Stacked standings checked at **320, 375, 390, 430, 600, 768 and 1024px**: all ranked rows, long names and every statistic exactly match the underlying division data; no row, component or page horizontal overflow. Gold and Silver divisions verified.
- Desktop checked at **1366 and 1920px**: original Material table stays visible; screenshot dimensions match the before capture, and 1366px table pixels match exactly. Original table structure/styles remain unchanged apart from removing the requested scroll instruction outside the table.
- Home ordering/layout checked at **1366, 1920, 375, 390 and 430px**.
- Compared actual Home rank with full K/Q component arrays after navigation: matchup fixture Overall 3rd of 5 and GM 2nd of 3; round fixture 2nd of 5. Fixtures exercise the actual 50% substitute adjustment, dropped score and mode-specific tie breakers.
- Verified identical player display names with different IDs, female-only participant counts, missing divisions, genuine zero scores, empty rankings, failed standings requests, league switching, stale responses and an account without a linked player. Existing latest K/Q score remains visible if only the rank request fails.

All application API responses were browser-intercepted deterministic fixtures. No SQL or database mutation tests, real-account login/attendance mutations, production operations or full regression suite were run. This task changed no persistence behavior.

## Screenshots

- [Mobile League Standings, 390px](mobile-league-home-evidence/league-standings-390.png)
- [Narrow League Standings, 320px](mobile-league-home-evidence/league-standings-320.png)
- [Intermediate League Standings, 768px](mobile-league-home-evidence/league-standings-768.png)
- [Desktop League Standings](mobile-league-home-evidence/desktop-league-standings-1366.png)
- [Mobile Home with K/Q rank above Game Scores](mobile-league-home-evidence/home-390.png)
- [Desktop Home](mobile-league-home-evidence/home-1366.png)

No publishing, deployment, commits, pushes or merges.
