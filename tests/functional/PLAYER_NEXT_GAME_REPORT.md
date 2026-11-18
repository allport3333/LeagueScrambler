# Player profile Next Game — November 18, 2026

## Implementation
Added a compact centered Your Next Game card immediately below the shared profile header and above the three unchanged statistics tabs. Maximum width is 620px. It shows the actual scheduled calendar date/week, player team, opponent and division when assigned, with View Full Schedule. Multiple matchups on the earliest date are all listed with an explicit count; one schedule link per distinct week/date avoids repeated buttons for same-week doubleheaders. If the player appears on both scheduled team rosters, that ambiguity is stated instead of inventing a single team association.

Membership uses existing StatisticsService.GetAllTeamsWithPlayers(leagueId), whose backend scopes LeagueTeam rows to LeagueID and projects LeagueTeamPlayer PlayerIds. It matches the viewed profile's PlayerId, never the authenticated user's ID or names. Schedule matching uses existing GetLeagueSchedule team1Id/team2Id and scheduleId; both sides are handled. Both APIs already contain sufficient stable identifiers: no backend/API/model/schema changes were needed.

The selection helper searches the selected league's actual saved schedule for matching team IDs, excluding dates before today, then selects the earliest eligible date. Bye weeks and unrelated games are skipped. Every qualifying game on that date is retained. Saved IDs suppress repeated representations of the same schedule row. Name collisions cannot alter matching. This uses recorded fixed roster membership, not inferred attendance or K/Q scramble assignments.

SQL schedule dates are treated as calendar dates without UTC conversion. Today uses America/New_York (the supplied local timezone), including daylight saving. Date keys are compared directly; no start/completion time is fabricated. Today's games remain eligible all day because the schema has no reliable start/completion time. There is no per-league timezone metadata: Eastern is an explicit current-app assumption, not a production timezone inspection; leagues in a different timezone would need an explicit timezone policy. No production configuration was read or changed.

## Loading and empty states
No assigned team, no schedule, no future games/ended season, and request failures are distinct. A full-schedule link remains when a schedule exists, even without a player game. K/Q leagues without fixed teams never get an invented opponent. Missing stable team IDs/roster projections produce a useful incomplete-data error rather than false opponent information. Loading shows no stale opponent/zero. Input-key guards, canceled subscriptions and version checks protect player/league changes and prevent duplicate requests for unchanged context. Component teardown cancels pending work.

## Full schedule link
URLs use `/league-dashboard?leagueId=...&tab=schedule&weekNumber=...&scheduleDate=YYYY-MM-DD`.

LeagueDashboard resolves the requested league with the existing LeagueService and selects its Schedule tab. LeagueSchedule accepts optional requested week/date inputs, selecting that exact API group after loading. Week number plus date disambiguates multiple saved date groups. An unavailable request is reported explicitly rather than showing an unrelated week. Requested selection is applied once so subsequent manual arrow/dropdown choices survive ordinary dashboard tab switching. A manual league change clears old requested-week context.

Without a requested week, the original closest-date method remains unchanged. Existing Dashboard tabs/cards and profile/statistics/navigation behavior are retained. Login, most-recent-league selection and authentication source were not modified.

## Executed verification
- **11 deterministic calculation groups passed**, executing the production TypeScript selection helper through the already-installed TypeScript compiler: Team1/Team2 identity, namesake teams, multiple same-day games, same-day inclusion, future/bye gaps, missing teams, no schedule, ended season, league-specific roster inputs, repeated schedule ID, empty week, civil date validation and Eastern DST transitions.
- **5 focused browser workflow groups passed** with Player-authenticated session fixtures: five viewport layouts, actual viewed player/team IDs, one initial request per endpoint, multiple/today/future games; profile-to-dashboard link/full week/refresh; manual week preservation; another player's profile; empty/no-team/ended states; failure/retry; delayed and rapid league changes with no stale opponent; explicit future week versus ordinary closest-date navigation.
- **4 existing schedule-navigation browser groups passed again** after the dashboard/input changes, preserving closest-week navigation, boundaries, gapped weeks, dropdown/manual choices, duplicate request protections, empty/single/error/retry/refresh behavior.
- **Angular development build passed** after final source changes. Existing outdated Browserslist warning remains. Log: artifacts/player-next-game-build.log.

These are grouped focused checks, not a full regression baseline run. Browser APIs were intercepted, all writes blocked, no page errors or write requests. No SQL, real credentials, mutation authorization, email, accounts, schedule changes, cleanup or production requests were used. Real login POST/navigation for the latest real membership league and live database-backed API reconciliation remain unverified; existing Player session behavior was exercised through fixtures. No backend build was necessary because backend source is unchanged.

## Screenshots
- [Desktop profile](player-profile-evidence/next-game-profile-1366.png)
- [Large desktop](player-profile-evidence/next-game-profile-1920.png)
- [Mobile 375](player-profile-evidence/next-game-profile-375.png)
- [Mobile 390](player-profile-evidence/next-game-profile-390.png)
- [Mobile 430](player-profile-evidence/next-game-profile-430.png)
- [No Upcoming Games / ended season](player-profile-evidence/next-game-season-ended.png)
- [No assigned team](player-profile-evidence/next-game-no-team.png)
- [Full schedule at requested week](player-profile-evidence/next-game-full-schedule.png)

Screenshots contain synthetic data. JSON evidence: next-game-calculation-results.json, next-game-browser-results.json, schedule-navigation-results.json in player-profile-evidence/.

## Files and repeat commands
Application changes: new ClientApp/src/app/player-next-game/next-game-selection.ts and player-next-game.component.ts/.html/.css; app.module.ts declaration; profile header insertion in player-stats-tabs.component.html; league-dashboard.component.ts/.html for league/tab/week URL resolution; league-schedule.component.ts for optional explicit week selection. Statistics services, APIs, authentication, calculations, schema and saved records were not changed. Existing pending work was preserved.

Testing/documentation: tests/functional/scripts/next-game-selection.cjs, extended scripts/player-profile-ui.cjs fixture mode, screenshots/results, this report and WORK_LOG.md.

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tests/functional/.tools/browsers'
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/next-game-selection.cjs
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/player-profile-ui.cjs --next-game
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/player-profile-ui.cjs --schedule-navigation
```

Use the existing local development Angular bundle. No packages installed. No publish, deploy, commit, push, merge, production/IIS/Cloudflare or deployment configuration changes. Task complete.