# FAQ update — November 18, 2026

## Scope
Updated the current local FAQ, including behavior introduced by pending development changes. The three original FAQ source files had no pending edits before this task. Other uncommitted work was preserved. No application behavior or rules were changed.

The FAQ now contains **19 questions** in **Getting Started (4), League Night (7), and Standings and Statistics (8)**. It retains a centered light container, independent expandable answers and restrained styling. Maximum width is 860px. Native question buttons provide Enter/Space activation, visible focus, expanded/collapsed indicators, aria-expanded, aria-controls, labeled answer panels and stable IDs. Questions and indicators wrap cleanly on phones. Inline Angular Router links preserve selected league context without generating guessed player-specific URLs.

## Existing ten questions reviewed and updated

| Original topic | Correction / retained guidance |
|---|---|
| Finding K/Q standings | Current navigation, Overall/division and gender tabs, Round/Matchup view, compact mobile versus Full Table. |
| Past K/Q matchups | Week browsing, exact saved-score links, highlighted rounds and View All Matchups; raw historical results remain distinct from adjusted standings. |
| Full league schedule | Dashboard Schedule tab and new arrows/week-date selector; closest-date loading differs from a profile's explicitly requested week. |
| Other players' statistics | Players search, desktop/Full Table name links and mobile expand then View Profile. |
| Randomness/team selection | Verified Math.random calls plus actual balancing/history constraints. Removed the claim that all draws are completely random or simply shuffle both lists. No guarantee of unique teams or equal probability. |
| Latest rules/revisions | Removed the unverified promise that rules are under the dashboard. Direct users to their organizer's published rules. |
| Personal statistics | Correct labels: King/Queen Stats, League Team Stats, League Player Stats; selected-league scope. |
| Substitutes versus personal stats | League-specific allowance/percentage/drop settings versus original saved K/Q history; removed a one-league half-points example as general guidance. |
| Looking up substitute information | Replaced Not currently with actual purple/Sub/Reduced standings indicators and yellow matchup Sub badges; no dedicated substitute-only profile report is promised. |
| Phone league-night sign-in | Own-profile action, authoritative confirmation, same existing attendance records and alternative Sign In Sheet. Account login is explicitly different from attendance. |

## Nine new questions

1. Finding pages and choosing a league, including measured More/mobile drawer behavior.
2. Finding one's own profile via login and Account/Profile.
3. Finding the next scheduled opponent.
4. Understanding No Upcoming Games, bye gaps and leagues without fixed teams.
5. Why attendance is unavailable, including configured league day, Eastern calendar, administrator locks, linkage and membership.
6. Recognizing already-signed-in attendance shared with administrators.
7. Removing one's own attendance when permitted, with confirmation.
8. Inspecting individual rounds, grouped detailed history and teammate links.
9. Understanding dropped/reduced scores, Total Points versus adjusted King Queen Score.

## Sources checked and accuracy limits

- NavMenu permission-filtered destinations, measured More allocation, account links and mobile drawer.
- Home login and LoginController.getuserleagues: Player login opens the linked profile using the first returned league, currently ordered by descending league ID. This is not a promise that login remembers the last manually viewed league or orders memberships by join timestamp.
- PlayerStatsTabs, DetailedPlayerStats, CombinedStatsTab and LeagueTeamPlayerScores: current categories, raw history, teammates and scoped statistics.
- PlayerNextGame selection and Dashboard/Schedule explicit-week navigation: stable membership/team IDs, earliest upcoming calendar date, same-day inclusion and full-week link.
- PlayerAttendance component/controller and AttendanceRules: ownership, membership, existing lock/day, confirmation, status refresh, unavailable messaging and distinction from login.
- LeagueStandings transformations/templates: substitute allowance/percentage, lowest-score dropping, raw Total Points, adjusted King Queen Score, color legend, mobile expansion/profile link and detailed-table links.
- Kqmatchups: saved week filtering, original scores/win markers, substitute badges and View All behavior.
- Scrambler: actual Math.random player/tie choices and Completely Random, balancing, saved-history/nonduplicate and locked-result paths. No algorithms modified or probabilistic fairness certification performed.

Official published league rules and their latest revisions were not supplied/verified. No dedicated rules section exists in the current Dashboard template (its four tabs are unchanged). Actual per-league setting values were not queried. The FAQ therefore does not set universal substitute limits/percentages, claim a particular sign-in cutoff time or replace official rules. Historical score reconciliation and real login/attendance mutations were not performed for this content task.

## Verification

- Angular development build **passed** after final wording changes, using existing Angular 7 dependencies. Existing outdated Browserslist warning remains. Log: artifacts/faq-update-build.log.
- **4 focused FAQ check groups passed:** 19 questions/three categories/native keyboard expansion and controlled panels; 375/390 layouts with all answers expanded and no overflow; all rendered URLs/league context and five destination routes; revised substitute/randomness/rules wording.
- All **10 inline link URLs** were verified. All **five distinct destinations** were clicked in the real Angular browser: Players, K/Q Standings, K/Q Matchups, Sign In Sheet and League Dashboard with Schedule selected. League2 remained selected. No guessed profile ID links exist.
- Screenshots cover desktop complete question list, an expanded question in each category, and mobile expanded answers.
- Zero page errors or write requests. HTTP APIs were intercepted with synthetic fixtures. No SQL, real account/attendance activity, production access or full regression suite.

One initial test loop used positional locators against a shrinking collapsed-question set and timed out; the test now expands/collapses the first matching item until none remain. The application did not require a fix for that test defect. A final content-only clarification avoids making an extra claim about counted wins; link/interaction behavior is unchanged.

## Screenshots

- [Complete desktop FAQ](player-profile-evidence/faq-desktop-complete.png)
- [Getting Started expanded](player-profile-evidence/faq-expanded-getting-started.png)
- [League Night expanded](player-profile-evidence/faq-expanded-league-night.png)
- [Standings and Statistics expanded](player-profile-evidence/faq-expanded-standings-statistics.png)
- [Mobile 375](player-profile-evidence/faq-mobile-375.png)
- [Mobile 390](player-profile-evidence/faq-mobile-390.png)

Results and checked URLs: player-profile-evidence/faq-update-results.json.

## Changed files / rerun

Application files only: ClientApp/src/app/faq/faq.component.ts, faq.component.html and faq.component.css. Focused fixtures/assertions extend tests/functional/scripts/player-profile-ui.cjs; evidence, this report and WORK_LOG.md updated. FAQ now observes the existing selected-league stream for links and unsubscribes on destruction; it makes no new API calls.

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tests/functional/.tools/browsers'
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/player-profile-ui.cjs --faq-update
```

Use the existing local development Angular bundle. No packages installed, backend/authentication/attendance/scoring/statistics/settings/scramble/schema/routes/roles/password changes, publish, deploy, commit, push, merge, production/IIS/Cloudflare or database changes. Task complete.