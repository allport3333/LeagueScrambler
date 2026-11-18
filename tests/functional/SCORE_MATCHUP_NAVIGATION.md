# Standings → K/Q Matchups navigation — completed 2026-11-17

## Behavior

Individual saved round/matchup scores now link to the existing K/Q Matchups page in all four detailed standings tables (Overall/divisions, Men/Women), mobile expanded details and mobile full-table mode. Totals remain plain. Links inherit the existing dropped/reduced/substitute colors, with a dotted underline, subtle hover/focus and mobile touch target.

Query parameters carry `leagueId`, the actual saved `scrambleNumber`, `playerId`, `kingQueenTeamId` and the raw `roundId` only for By Round. They also carry return mode/division/gender. Displayed Matchup/Week numbers are never used as database identifiers.

The target page waits for league/week data, updates the existing week dropdown, loads the saved team roster and original round scores, validates player membership/round existence, and displays one pair with its original Match number and Team numbers. A round link highlights only that player's team's requested saved round; an aggregate matchup link shows its original individual rounds without inventing a single-round highlight. Adjusted standings values are never copied into historical details.

Back to Standings restores the league, mode and practical division/gender selection. View All Matchups removes the focus filter and shows all teams/byes for the selected week. Changing weeks returns to all-matchups mode. Changing navigation league exits score focus and starts normal browsing in that league rather than forcing the old league back. Normal navigation-menu entry has no extra Back button and retains ordinary week/all-matchup/bye browsing.

Saved zero values are linked. Absent normalized placeholder scores are not. Ambiguous player/team associations remain unlinked. Invalid/missing league, week, team, player or round data and incomplete pairs produce a message without showing an unrelated pair. Query parameters survive a direct refresh.

## Relationship evidence and limitation

The current schema has no separate opposing-team foreign key for KingQueenTeam. This implementation uses the **existing application's save-order contract**, not arbitrary SQL result order:

- GenerateScramble creates team records in submitted team order.
- SaveKingQueenTeams explicitly retrieves teams with `OrderBy(kt => kt.Id)` and assigns each submitted roster to the corresponding indexed saved team.
- The existing UI defines matches as consecutive pairs in that submitted order.

GetKingQueenTeamsByScrambleNumber now explicitly returns ascending saved IDs. The client also sorts by those IDs, assigns original team/match positions **before** filtering and retains those positions. Browser tests deliberately shuffle the response and select teams 7/8 to verify Match #4 remains Match #4. Incomplete weeks, empty paired rosters and overlapping players in opposing teams are rejected in focused mode.

This is deterministic for records produced under that established workflow. The model cannot independently recover a different pairing for externally imported/reordered data that did not follow that contract. No schema migration or speculative reconstruction was added. Such historical data would need an authoritative mapping; this feature does not claim to recover it.

Both standings read endpoints add `hasSavedScore` and `kingQueenTeamId`. Existing `scrambleNumber` and raw round metadata survive the component's object-copy transformations. By Round marks exactly one matching saved score as linkable; By Matchup marks an aggregate linkable only when one distinct saved team supplies it. Score/win sums, normalization, rankings, drops and substitute adjustments are unchanged. SelectedLeagueScrambles now orders saved weeks by actual scramble number.

## Verification actually executed

- **12 main focused browser check groups passed, 0 failed.** They cover mobile round/matchup clicks, saved zero vs placeholder, original raw results/highlight, league B rather than the first default league, noncontiguous scramble numbers 12/39, saved team/player/opponent IDs, Match #4 numbering, refresh, Back, View All/byes, manual week change, desktop/mobile full-table links, all Overall/division/gender contexts, missing/invalid links and normal browsing.
- **1 additional focused league-change check passed** after fixing the confirmed query-parameter edge case. Previously passing main groups were not unnecessarily rerun after that isolated change.
- **Read-only real development API checks passed** against retained exact LSAuto synthetic league records: 4 score associations matched SQL snapshots across GetByLeague/GetByLeagueMatchup, and 4 read endpoints verified metadata and deterministic week/team ordering. This was not a mutating test run.
- Backend Debug build passed: 0 errors, 10 existing framework/package/MVC warnings. Angular development and production/AOT builds passed with the existing installed packages/Node10. Existing Browserslist warning only. No dependency installation/upgrades.
- Full functional suite and database-mutating tests were not run. No new synthetic database data or cleanup was performed.

The browser checks used the actual local Angular UI with intercepted synthetic API responses; every write/external URL was blocked. They prove browser behavior, not every historical production record. Final browser errors/API write attempts: zero.

The real API reads independently verified the running VS Debug PID5952 (start2026-11-17T23:30:08.8096210Z) and effective localhost/LeagueScramblerDev/Windows Authentication settings using the existing read-only safeguard, with unchanged identity/configuration hashes before/after reads. Automated SQL session correlation **did not pass** and is not reported successful. No mutation authorization was issued or renewed. The existing development Debug application was stopped/rebuilt/restarted for the additive response changes; production was not accessed.

## Screenshots and results

- [Clickable mobile standings](score-links-evidence/mobile-clickable-standings.png)
- [Single Match #4, mobile](score-links-evidence/mobile-single-matchup.png)
- [Single Match #4, desktop](score-links-evidence/desktop-single-matchup.png)
- [Main browser results](score-links-evidence/results.json)
- [League-change result](score-links-evidence/league-change.json)
- [Read-only development API evidence](score-links-evidence/api-readonly.json)

All screenshots contain synthetic browser display records only. They preserve the existing blue/pink player colors, substitute and WON badges and existing card layout.

## Exact files changed for this feature

- `Controllers/ScrambleDataController.cs`: additive read-only score metadata and deterministic saved week/team response ordering.
- `ClientApp/src/app/data-models/playerScoresResponse.ts`: optional saved score linkage metadata.
- `ClientApp/src/app/services/league.service.ts`: read-only deep-link league resolution using existing lists/public league lookup; no authentication changes.
- `ClientApp/src/app/league-standings/league-standings.component.ts`: link query generation, return mode/division/gender and league handling, selected-league subscription cleanup.
- `ClientApp/src/app/league-standings/league-standings.component.html`: individual-score anchors and controlled return tab selection.
- `ClientApp/src/app/league-standings/league-standings.component.css`: score-link hover/focus/touch presentation.
- `ClientApp/src/app/kqmatchups/kqmatchups.component.ts`: query-driven selection, deterministic pairing/filtering, original numbering, safe resolution, navigation controls and stale-request cleanup.
- `ClientApp/src/app/kqmatchups/kqmatchups.component.html`: existing dropdown value, original numbering, round highlight, Back/View All and messages.
- `ClientApp/src/app/kqmatchups/kqmatchups.component.css`: small navigation/error/highlight styles.
- `tests/functional/scripts/score-links.cjs` and `score-links-api-readonly.cjs`: focused browser and read-only API checks.
- `tests/functional/Run-ScoreLinks.ps1`, `score-links-evidence/`, this report and WORK_LOG.

Prior pending work was preserved. No schema, stored historical score, scoring/standing calculations, authentication/legacy password/cookie/authorization, production, IIS, Cloudflare, publish/deploy, commit/push/merge changes.

## Focused rerun commands

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/functional/Run-ScoreLinks.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/functional/Run-ScoreLinks.ps1 -LeagueChangeOnly
powershell -NoProfile -ExecutionPolicy Bypass -File tests/functional/Run-ScoreLinks.ps1 -ApiReadOnly
```

The first two commands use browser fixtures only. The final command requires an independently verifiable local VS Debug development process and retained synthetic database records, and fails closed if either is unavailable. No mutation grant is bypassed. Work stops at this feature.

## Follow-up: missing league LINQ exception (2026-11-17 local time)

The user identified SelectedLeagueScrambles as the throwing action. Confirmed cause: FirstOrDefault may return null, and EF attempts to evaluate captured league.ID while extracting the next query's parameters, wrapping NullReferenceException in InvalidOperationException. No sensitive-data logging was enabled.

Fixed the action to reject blank input with an empty array, query a nullable scalar ID, return an empty array when the league is absent, and use a nonnullable ID only after checking it. Its context is disposed and its normal saved-week ordering/array contract is retained. Added a guard in PlayerService.SelectedLeagueScrambles so all callers (including early Scrambler tab callbacks) skip HTTP for null/undefined/empty/whitespace selection; legitimate names are URL-encoded.

Backend Debug and Angular development builds passed (10 existing backend warnings, existing Browserslist warning). Read-only checks against independently verified localhost/LeagueScramblerDev passed the normal four read endpoints/four score associations plus two real API cases for a guaranteed-absent synthetic league and whitespace. Both return200/[] without the exception. The actual Angular service passed four empty-input/no-request cases and valid-name URL encoding using intercepted transport. No full-suite repeat or DB writes.

The existing Visual Studio Debug application was rebuilt/restarted; new process33080/start2026-11-18T00:01:13.9983690Z was independently verified Development/localhost/LeagueScramblerDev/WindowsAuthentication. No mutation grant, automated session-correlation success claim, production access or deployment. Evidence: score-links-evidence/api-readonly.json and null-league-client.json; focused client script scripts/scramble-league-guard.cjs. Existing read-only runner includes the negative cases.
